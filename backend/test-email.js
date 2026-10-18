
require("dotenv").config();
const nodemailer = require("nodemailer");

async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    console.log("Gmail SMTP connected successfully!");

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER,
      subject: "InZone OTP Email Test",
      text: "Your InZone Gmail SMTP connection is working."
    });

    console.log("Email accepted!");
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("EMAIL ERROR:", error.code, error.message);
  }
}

testEmail();
