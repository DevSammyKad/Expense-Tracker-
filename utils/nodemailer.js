import nodemailer from 'nodemailer';

export const sendResetEmail = async (to, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'herta.torphy@ethereal.email',
      pass: 's2waRxJ3yD1NpZ4Nqt',
    },
  });

  const mailOptions = {
    from: `"Support" <${process.env.EMAIL_USER || 'default@example.com'}>`, // Fallback to a default email if not set
    to,
    subject: 'Reset Your Password',
    html: `
      <p>You requested a password reset.</p>
      <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
      <p>This link expires in 1 hour.</p>
    `,
  };

  console.log('Sending password reset email to:', to);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new AppError('Failed to send email. Please try again later.', 500);
  }
};
