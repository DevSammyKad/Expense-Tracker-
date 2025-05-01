import bcrypt from 'bcrypt';
import { getPool } from '../config/db.js';
import { generateToken } from '../utils/jwt.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import dotenv from 'dotenv';

dotenv.config();
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

export const register = catchAsync(async (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;

  // Validate input
  if (!name || !email || !password) {
    throw new AppError('Please provide name, email and password', 400);
  }

  if (!phone) {
    throw new AppError('Please provide a phone number', 400);
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  const pool = getPool();

  // Check if user already exists
  const [existingUsers] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  if (existingUsers.length > 0) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const [result] = await pool.query(
    'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
    [name, email, phone || null, hashedPassword]
  );

  const userId = result.insertId;

  // Generate token
  const token = generateToken({ id: userId });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      id: userId,
      name,
      email,
      token,
    },
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const pool = getPool();

  // Check if user exists
  const [users] = await pool.query(
    'SELECT id, name, email, password FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    throw new AppError('Invalid credentials', 401);
  }

  const user = users[0];

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate token
  const token = generateToken({ id: user.id });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      token,
    },
  });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Please provide an email address', 400);
  }

  const pool = getPool();

  // Check if user exists
  const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [
    email,
  ]);

  if (users.length === 0) {
    // Don't reveal if email exists for security
    return res.status(200).json({
      success: true,
      message:
        'If your email is registered, you will receive a password reset link',
    });
  }

  const user = users[0];

  // Generate token valid for 1 hour
  const resetToken = generateToken(
    { id: user.id, purpose: 'password_reset' },
    '1h'
  );

  // In a real application, send an email with reset link
  // For this demo, we'll just return the token

  res.status(200).json({
    success: true,
    message:
      'If your email is registered, you will receive a password reset link',
    // In a real app, don't return the token in the response
    // Only for demonstration purposes
    devInfo: {
      resetToken,
    },
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    throw new AppError(
      'Please provide token, password and confirm password',
      400
    );
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  // Verify token
  const decoded = verifyToken(token);

  if (
    !decoded.valid ||
    decoded.expired ||
    decoded.decoded.purpose !== 'password_reset'
  ) {
    throw new AppError('Invalid or expired token', 401);
  }

  const userId = decoded.decoded.id;
  const pool = getPool();

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Update password
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [
    hashedPassword,
    userId,
  ]);

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
  });
});
