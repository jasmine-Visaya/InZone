const nodemailer = require('nodemailer');

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS are required in backend/.env');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendOtpEmail(email, code, purpose) {
  const isVerify = purpose === 'verify_email';
  const subject = isVerify ? 'InZone - Verify your email' : 'InZone - Reset your password';
  const action = isVerify ? 'complete your InZone registration' : 'reset your InZone password';
  await transport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text: `Use this InZone verification code to ${action}: ${code}. It expires in 10 minutes. If you did not request this, ignore the email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:28px;color:#173d32">
      <h2 style="color:#087957">InZone</h2>
      <p>Use this code to ${action}:</p>
      <p style="font-size:34px;letter-spacing:9px;font-weight:800">${code}</p>
      <p>Valid for <strong>10 minutes</strong>. Do not share this code.</p>
      <p style="color:#778d83;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>`,
  });
}
module.exports = { sendOtpEmail };
