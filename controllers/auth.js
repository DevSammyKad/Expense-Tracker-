import bcrypt from 'bcrypt';
import { getPool } from '../config/db.js';
import { generateToken } from '../utils/jwt.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';
import dotenv from 'dotenv';
import { sendResetEmail } from '../utils/nodemailer.js';
import { JwksClient } from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const appleClient = new JwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});

async function getAppleSigningKey(kid) {
  try {
    const key = await appleClient.getSigningKey(kid);
    return key.getPublicKey();
  } catch (err) {
    throw new AppError('Failed to fetch Apple signing key', 400);
  }
}

dotenv.config();
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

export const appleLogin = catchAsync(async (req, res) => {
  const { id_token } = req.body;

  if (!id_token) {
    throw new AppError('Apple ID token is required', 400);
  }

  // Decode the token to get the header
  let decoded;
  try {
    decoded = jwt.decode(id_token, { complete: true });
  } catch (err) {
    throw new AppError('Invalid Apple ID token', 400);
  }

  if (!decoded || !decoded.header) {
    throw new AppError('Invalid Apple ID token structure', 400);
  }

  const { header } = decoded;
  const kid = header.kid;

  try {
    const publicKey = await getAppleSigningKey(kid);
    // Verify the token with Apple's public key
    const verifiedToken = jwt.verify(id_token, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID, // Your Apple service ID
      issuer: 'https://appleid.apple.com',
    });

    // Token is valid - proceed with your login logic
    // Extract user info from verifiedToken (email, sub, etc.)
    const appleId = verifiedToken.sub;
    const email = verifiedToken.email;

    // Your existing user handling logic here...
    // Check if user exists, create if not, generate session, etc.

    res.status(200).json({
      success: true,
      data: {
        appleId,
        email,
        // Include any other user data you want to return
      },
    });
  } catch (err) {
    throw new AppError(`Apple authentication failed: ${err.message}`, 401);
  }
});

export const googleLogin = catchAsync(async (req, res) => {
  try {
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token or provider.',
      });
    }

    let userInfo = {};
    let providerIdField = ''; // Either "google_id" or "facebook_id"

    // Token Verification and Data Extraction

    const response = await axios.get(
      ` https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
    );
    console.log('response-->', response.data);

    userInfo.email = response.data.email;
    userInfo.providerId = response.data.sub;
    providerIdField = 'google_id';

    // Find User by Email
    let user = await UserRegistration.findOne({
      where: { email: userInfo.email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sign up manually first.',
      });
    }

    // First Time Social Login - Save ID
    if (!user[providerIdField]) {
      user[providerIdField] = userInfo.providerId;
      await user.save();
    }

    // Match Provider ID
    if (user[providerIdField] !== userInfo.providerId) {
      return res.status(401).json({
        success: false,
        message: ` ${provider} account does not match our records`,
      });
    }

    // Generate JWT Token
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful via social login',
      token: jwtToken,
    });
  } catch (error) {
    console.error('❌ Social Login Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

export const GoogleAndAppleLogin = catchAsync(async (req, res) => {
  const { provider, response } = req.body;

  if (!provider || !response) {
    throw new AppError('Provider and response are required', 400);
  }

  if (provider === 'apple') {
    const { identityToken } = response;

    if (!identityToken || typeof identityToken !== 'string') {
      console.log('Invalid identityToken:', identityToken);
      throw new AppError('Apple identity token is missing or invalid', 400);
    }
    console.log('Received identityToken:', identityToken);
    if (identityToken.split('.').length !== 3) {
      console.log('Token parts:', identityToken.split('.'));
      throw new AppError('Invalid Apple token format', 400);
    }

    const decoded = jwt.decode(identityToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new AppError('Invalid Apple token header', 400);
    }

    const kid = decoded.header.kid;

    let key;
    try {
      key = await getAppleSigningKey(kid);
    } catch (err) {
      throw new AppError('Failed to fetch Apple signing key', 400);
    }

    let payload;
    try {
      payload = jwt.verify(identityToken, key, { algorithms: ['RS256'] });
    } catch (err) {
      throw new AppError('Apple token verification failed', 401);
    }

    const userId = payload.sub;
    const email = payload.email;

    const token = generateToken({ id: userId, email });

    return res.status(200).json({
      success: true,
      token,
      user: { id: userId, email },
    });
  } else if (provider === 'google') {
    const { idToken } = response;

    if (!idToken || typeof idToken !== 'string') {
      console.log('Invalid idToken:', idToken);
      throw new AppError('Google ID token is missing or invalid', 400);
    }

    console.log('Received Google idToken:', idToken); // Log the received token

    // Verify the Google ID token
    try {
      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v3/tokeninfo',
        {
          params: { id_token: idToken },
        }
      );

      const payload = response.data;
      console.log('Google tokeninfo payload:', payload); // Log the tokeninfo response
      console.log('Expected GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
      console.log('Received aud:', payload.aud);

      // Verify the audience (client ID)
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new AppError(
          `Google token audience mismatch. Expected: ${process.env.GOOGLE_CLIENT_ID}, Received: ${payload.aud}`,
          401
        );
      }

      // Verify token is not expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp < currentTime) {
        throw new AppError('Google token has expired', 401);
      }

      const userId = payload.sub; // Google's unique user ID
      const email = payload.email;

      // Optionally, check if user exists in your database or create a new user
      const pool = getPool();
      let user;
      try {
        const { rows } = await pool.query(
          'SELECT * FROM users WHERE google_id = $1 OR email = $2',
          [userId, email]
        );
        user = rows[0];

        if (!user) {
          // Create a new user if they don't exist
          const { rows: newUser } = await pool.query(
            'INSERT INTO users (google_id, email, created_at) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, email]
          );
          user = newUser[0];
        }
      } catch (err) {
        console.error('Database error:', err);
        throw new AppError('Failed to process user data', 500);
      }

      // Generate JWT token
      const token = generateToken({ id: userId, email });

      return res.status(200).json({
        success: true,
        token,
        user: { id: userId, email },
      });
    } catch (err) {
      console.error('Google token verification failed:', err);
      throw new AppError(
        `Google token verification failed: ${err.message}`,
        401
      );
    }
  }

  throw new AppError('Unsupported provider', 400);
});

export const register = catchAsync(async (req, res) => {
  const { first_name, last_name, email, phone, password, confirmPassword } =
    req.body;

  // Validate input
  if (!first_name || !email || !password) {
    throw new AppError('Please provide first Name, email and password', 400);
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
    'INSERT INTO users (first_name, last_name ,email, phone, password) VALUES (?, ?, ?, ?, ?)',
    [first_name, last_name, email, phone || null, hashedPassword]
  );

  const userId = result.insertId;

  // Generate token
  const token = generateToken({
    id: userId,
    name: `${first_name} ${last_name}`,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      id: userId,
      name: first_name + ' ' + last_name,
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
    'SELECT id, first_name,last_name, email, password FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    throw new AppError('Invalid credentials', 401);
  }

  const user = users[0];

  console.log('user', user);

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials : Incorrect password', 401);
  }

  // Generate token
  const token = generateToken({ id: user.id });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      id: user.id,
      name: user.first_name + ' ' + user.last_name,
      email: user.email,
      token,
    },
  });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  console.log('Received forgot password request:', email);

  if (!email) {
    console.error('Email not provided');
    throw new AppError('Please provide an email address', 400);
  }

  const pool = getPool();

  try {
    // Check if user exists
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [
      email,
    ]);

    // Send generic response to avoid revealing if email is registered
    if (users.length === 0) {
      console.log('Email is not registered (no information leakage)');
      return res.status(200).json({
        success: true,
        message:
          'If your email is registered, you will receive a password reset link.',
      });
    }

    const user = users[0];

    // Generate token valid for 1 hour
    const resetToken = generateToken(
      { id: user.id, purpose: 'password_reset' },
      '1h'
    );

    // ✅ Send reset email
    await sendResetEmail(email, resetToken);

    return res.status(200).json({
      success: true,
      message:
        'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    throw new AppError('Something went wrong. Please try again.', 500);
  }
});

// In a real application, send an email with reset link

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

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
