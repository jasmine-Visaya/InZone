
const nodemailer = require('nodemailer');

/* =========================================
   SMTP TRANSPORT (FALLBACK)
========================================= */

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error(
      'SMTP_HOST, SMTP_USER and SMTP_PASS are required.'
    );
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/* =========================================
   RESEND HTTPS EMAIL API
   PRIMARY SENDER FOR RENDER
========================================= */

async function sendEmailViaResend({
  email,
  subject,
  text,
  html,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    throw new Error(
      'RESEND_API_KEY and RESEND_FROM are required.'
    );
  }

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Resend email failed (${response.status}): ${
        result.message || 'Unknown error'
      }`
    );
  }

  return result;
}

/* =========================================
   SEND OTP EMAIL
   EMAIL VERIFICATION / PASSWORD RESET
========================================= */

async function sendOtpEmail(email, code, purpose) {
  const isVerify = purpose === 'verify_email';

  const subject = isVerify
    ? 'InZone - Verify your email'
    : 'InZone - Reset your password';

  const action = isVerify
    ? 'complete your InZone registration'
    : 'reset your InZone password';

  const text =
    `Use this InZone verification code to ${action}: ${code}. ` +
    'It expires in 10 minutes. ' +
    'If you did not request this, ignore the email.';

  const html = `
    <div style="
      font-family:Arial,sans-serif;
      max-width:480px;
      margin:auto;
      padding:28px;
      color:#173d32;
    ">
      <h2 style="color:#087957">InZone</h2>

      <p>Use this code to ${action}:</p>

      <div style="
        background:#eff8f3;
        padding:20px;
        border-radius:12px;
        text-align:center;
        margin:20px 0;
      ">
        <p style="
          font-size:34px;
          letter-spacing:9px;
          font-weight:800;
          color:#087957;
          margin:0;
        ">${code}</p>
      </div>

      <p>
        Valid for <strong>10 minutes</strong>.
        Do not share this code.
      </p>

      <p style="
        color:#778d83;
        font-size:12px;
      ">
        If you didn't request this,
        you can ignore this email.
      </p>
    </div>
  `;

  /* PRIMARY: RESEND HTTPS API */

  if (process.env.RESEND_API_KEY) {
    return await sendEmailViaResend({
      email,
      subject,
      text,
      html,
    });
  }

  /* FALLBACK: SMTP */

  return await transport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html,
  });
}

/* =========================================
   EXPORT
========================================= */

module.exports = {
  sendOtpEmail,
};