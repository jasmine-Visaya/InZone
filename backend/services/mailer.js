
/* =========================================
   INZONE EMAIL SERVICE
   BREVO HTTPS API - RENDER COMPATIBLE
========================================= */

/* =========================================
   BREVO EMAIL SENDER
========================================= */

async function sendEmailViaBrevo({
  email,
  subject,
  text,
  html,
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName =
    process.env.BREVO_SENDER_NAME || "InZone";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "BREVO_API_KEY and BREVO_SENDER_EMAIL are required."
    );
  }

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: email,
          },
        ],
        subject: subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const message =
      result.message ||
      result.error ||
      "Unknown Brevo API error";

    console.error(
      "[InZone] Brevo API error:",
      response.status,
      message
    );

    throw new Error(
      `Brevo email failed (${response.status}): ${message}`
    );
  }

  console.log(
    "[InZone] Email accepted by Brevo:",
    result.messageId || "No message ID"
  );

  return result;
}

/* =========================================
   SEND OTP EMAIL
   REGISTRATION / PASSWORD RESET
========================================= */

async function sendOtpEmail(email, code, purpose) {
  const isVerify = purpose === "verify_email";

  const subject = isVerify
    ? "InZone - Verify your email"
    : "InZone - Reset your password";

  const action = isVerify
    ? "complete your InZone registration"
    : "reset your InZone password";

  const text =
    `Use this InZone verification code to ${action}: ${code}. ` +
    "It expires in 10 minutes. " +
    "If you did not request this, ignore the email.";

  const html = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 480px;
      margin: auto;
      padding: 28px;
      color: #173d32;
    ">

      <h2 style="
        color: #087957;
        font-size: 26px;
        margin-bottom: 20px;
      ">
        InZone
      </h2>

      <p style="
        font-size: 15px;
        line-height: 1.6;
      ">
        Use this code to ${action}:
      </p>

      <div style="
        background: #eff8f3;
        border: 1px solid #d3ebdd;
        border-radius: 12px;
        padding: 22px;
        text-align: center;
        margin: 20px 0;
      ">

        <p style="
          font-size: 34px;
          letter-spacing: 9px;
          font-weight: 800;
          color: #087957;
          margin: 0;
        ">
          ${code}
        </p>

      </div>

      <p style="
        font-size: 14px;
        line-height: 1.6;
      ">
        Valid for
        <strong>10 minutes</strong>.
        Do not share this code.
      </p>

      <p style="
        color: #778d83;
        font-size: 12px;
        margin-top: 24px;
      ">
        If you didn't request this,
        you can ignore this email.
      </p>

    </div>
  `;

  return await sendEmailViaBrevo({
    email,
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
