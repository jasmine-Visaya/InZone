const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../src/config/database'); // matches your existing backend/controllers/authController.js
const { sendOtpEmail } = require('../services/mailer');

const OTP_PURPOSE = { VERIFY: 'verify_email', RESET: 'reset_password' };
const GENERIC_RESET_MESSAGE = 'If this email is registered and verified, a reset code has been sent.';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const validPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 128;

function hashOtp(email, purpose, code) {
  if (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32) {
    throw new Error('Set a random OTP_SECRET (at least 32 characters) in backend/.env');
  }
  return crypto.createHmac('sha256', process.env.OTP_SECRET)
    .update(`${purpose}:${email}:${code}`).digest('hex');
}

function newCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// Atomic upsert enforces a 60-second cooldown across requests/processes.
async function issueOtp(email, purpose) {
  const code = newCode();
  const digest = hashOtp(email, purpose, code);
  const result = await pool.query(`
    INSERT INTO auth_otps (email, purpose, code_hash, expires_at, attempts, last_sent_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', 0, NOW())
    ON CONFLICT (email, purpose)
    DO UPDATE SET code_hash = EXCLUDED.code_hash,
                  expires_at = EXCLUDED.expires_at,
                  attempts = 0,
                  last_sent_at = NOW()
    WHERE auth_otps.last_sent_at <= NOW() - INTERVAL '60 seconds'
    RETURNING email
  `, [email, purpose, digest]);
  if (!result.rowCount) return { sent: false, cooldown: true };
  try {
    await sendOtpEmail(email, code, purpose);
    return { sent: true, cooldown: false };
  } catch (error) {
    console.error('[InZone] OTP email delivery failed:', error.message);
    // Remove only our code so an immediate resend is possible if SMTP is fixed.
    await pool.query('DELETE FROM auth_otps WHERE email=$1 AND purpose=$2 AND code_hash=$3', [email, purpose, digest]).catch(() => {});
    return { sent: false, cooldown: false, mailError: true };
  }
}

// Lock the OTP row during validation so each code can be consumed only once.
// Wrong attempts are committed, even though verification fails.
async function checkAndConsumeOtp(client, email, purpose, code) {
  const result = await client.query(
    'SELECT * FROM auth_otps WHERE email=$1 AND purpose=$2 FOR UPDATE',
    [email, purpose]
  );
  const row = result.rows[0];
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) return false;
  if (row.attempts >= 5) return false;

  const proposed = Buffer.from(hashOtp(email, purpose, code), 'hex');
  const expected = Buffer.from(row.code_hash, 'hex');
  const matches = proposed.length === expected.length && crypto.timingSafeEqual(proposed, expected);
  if (!matches) {
    await client.query(
      'UPDATE auth_otps SET attempts=attempts+1 WHERE email=$1 AND purpose=$2',
      [email, purpose]
    );
    return false;
  }
  await client.query('DELETE FROM auth_otps WHERE email=$1 AND purpose=$2', [email, purpose]);
  return true;
}

function serverError(res, error) {
  console.error('[InZone auth]', error);
  return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const first_name = String(req.body?.first_name || '').trim();
    const last_name = String(req.body?.last_name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!first_name || !last_name || first_name.length > 100 || last_name.length > 100 || !validEmail(email) || !validPassword(password)) {
      return res.status(400).json({ success: false, message: 'Enter your name, a valid email, and a password of 8–128 characters.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1', [email]);
    if (existing.rowCount) return res.status(409).json({ success: false, message: 'This email is already registered. Try signing in.' });

    const passwordHash = await bcrypt.hash(password, 12);
    // Email verification is separate from existing ADMIN approval.
    // New student accounts are PENDING until an admin approves them.
    try {
      await pool.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, role, status, email_verified)
        VALUES ($1, $2, $3, $4, 'STUDENT', 'PENDING', FALSE)
      `, [first_name, last_name, email, passwordHash]);
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'This email is already registered.' });
      throw error;
    }

    const result = await issueOtp(email, OTP_PURPOSE.VERIFY);
    return res.status(201).json({
      success: true,
      email_sent: result.sent,
      message: result.sent
        ? 'Account created. Enter the 6-digit code sent to your email.'
        : 'Account created, but email delivery failed. Check email settings and use Resend code.',
    });
  } catch (error) { return serverError(res, error); }
}

// POST /api/auth/verify-register-otp
async function verifyRegisterOtp(req, res) {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || '').trim();
  if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: 'Enter your email and 6-digit code.' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const valid = await checkAndConsumeOtp(client, email, OTP_PURPOSE.VERIFY, otp);
    if (!valid) {
      await client.query('COMMIT');
      return res.status(400).json({ success: false, message: 'Invalid, expired, or used code. Resend to get a new one.' });
    }
    const updated = await client.query(
      'UPDATE users SET email_verified=TRUE WHERE LOWER(email)=$1 AND email_verified=FALSE RETURNING id', [email]
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This account is already verified or unavailable.' });
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Email verified! Your account is now awaiting staff approval.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return serverError(res, error);
  } finally { if (client) client.release(); }
}

// POST /api/auth/resend-register-otp
async function resendRegisterOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email.' });
    const result = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1 AND email_verified=FALSE', [email]);
    if (!result.rowCount) return res.json({ success: true, message: 'If this email needs verification, a code has been sent.' });
    const otp = await issueOtp(email, OTP_PURPOSE.VERIFY);
    if (otp.cooldown) return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another code.' });
    if (otp.mailError) return res.status(503).json({ success: false, message: 'Email delivery unavailable. Check your SMTP configuration.' });
    return res.json({ success: true, message: 'A new verification code was sent.' });
  } catch (error) { return serverError(res, error); }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email.' });
    const result = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1 AND email_verified=TRUE', [email]);
    if (result.rowCount) await issueOtp(email, OTP_PURPOSE.RESET);
    // Deliberately avoid telling callers whether an account exists.
    return res.json({ success: true, message: GENERIC_RESET_MESSAGE });
  } catch (error) { return serverError(res, error); }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || '').trim();
  const newPassword = req.body?.new_password;
  if (!validEmail(email) || !/^\d{6}$/.test(otp) || !validPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 6-digit code and a password of 8–128 characters.' });
  }
  let client;
  try {
    const newHash = await bcrypt.hash(newPassword, 12);
    client = await pool.connect();
    await client.query('BEGIN');
    const valid = await checkAndConsumeOtp(client, email, OTP_PURPOSE.RESET, otp);
    if (!valid) {
      await client.query('COMMIT');
      return res.status(400).json({ success: false, message: 'Invalid, expired, or used code. Request a new one.' });
    }
    const updated = await client.query(`
      UPDATE users SET password_hash=$1, token_version=token_version+1
      WHERE LOWER(email)=$2 AND email_verified=TRUE RETURNING id
    `, [newHash, email]);
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Account is unavailable.' });
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return serverError(res, error);
  } finally { if (client) client.release(); }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Enter a valid email and password.' });
    }
    const result = await pool.query(`
      SELECT id, first_name, last_name, email, password_hash, role, status, email_verified, token_version
      FROM users WHERE LOWER(email)=$1 LIMIT 1
    `, [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email first. Enter the code sent during registration.' });
    }
    // Preserve your current login policy: only APPROVED accounts can sign in.
    const status = String(user.status || '').toUpperCase();
    if (status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_NOT_APPROVED',
        message: status === 'REJECTED' ? 'Your account was rejected. Contact the administrator.' : 'Your account is awaiting administrator approval.',
      });
    }
    const role = String(user.role || '').toUpperCase();
    if (!['STUDENT', 'SUPERVISOR', 'ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Unsupported account role.' });
    }
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const token = jwt.sign({ id: user.id, email: user.email, role, token_version: user.token_version }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({
      success: true, token,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role, status: user.status },
    });
  } catch (error) { return serverError(res, error); }
}

module.exports = { register, login, verifyRegisterOtp, resendRegisterOtp, forgotPassword, resetPassword };
