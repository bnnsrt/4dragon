import { sendEmail } from './smtp';

export async function sendVerificationCode(email: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f97316; text-align: center;">Email Verification</h2>
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin-top: 20px;">
        <p style="margin-bottom: 20px;">Your verification code is:</p>
        <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${code}
        </div>
        <p style="margin-top: 20px; color: #666;">This code will expire in 10 minutes.</p>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        If you didn't request this verification code, please ignore this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Your Verification Code',
    html,
  });
}