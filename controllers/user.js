import { getPool } from '../config/db.js';
import { catchAsync } from '../middleware/errorHandler.js';

export const UpdateUserProfile = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name, phone, gender, birth_date } = req.body;

  if (!first_name || !last_name) {
    throw new AppError('First name and last name are required', 400);
  }

  const pool = getPool();

  // Check if user exists
  const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ?', [
    userId,
  ]);

  if (existingUser.length === 0) {
    throw new AppError('User not found', 404);
  }

  // Update user profile
  await pool.query(
    `
    UPDATE users
    SET first_name = ?, last_name = ?, phone = ?, gender = ?, birth_date = ?
    WHERE id = ?
    `,
    [first_name, last_name, phone, gender, birth_date, userId]
  );

  // Fetch updated user
  const [updatedUser] = await pool.query(
    'SELECT id, first_name, last_name, email, phone, gender, birth_date FROM users WHERE id = ?',
    [userId]
  );

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser[0],
  });
});

export const getUsers = catchAsync(async (req, res) => {
  const pool = getPool();
  const [users] = await pool.query('SELECT * FROM users');
  const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
  const totalUsers = countResult[0].total;
  res.status(200).json({
    success: true,
    message: 'Users fetched successfully',
    count: totalUsers,
    data: users,
  });
});
