import { getPool } from '../config/db.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';

export const getCategories = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const pool = getPool();

  const [categories] = await pool.query(
    `
    SELECT * FROM categories 
    WHERE is_default = true OR user_id = ?
    ORDER BY is_default DESC, name ASC
    `,
    [userId]
  );

  res.status(200).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: categories,
  });
});

export const createCategory = catchAsync(async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!name) {
    throw new AppError('Please provide a category name', 400);
  }

  const pool = getPool();

  // Check if category already exists for this user
  const [existingCategories] = await pool.query(
    'SELECT id FROM categories WHERE name = ? AND user_id = ?',
    [name, userId]
  );

  if (existingCategories.length > 0) {
    throw new AppError('Category with this name already exists', 409);
  }

  // Create category
  const [result] = await pool.query(
    'INSERT INTO categories (name, icon, user_id) VALUES (?, ?, ?)',
    [name, name, userId]
  );

  const categoryId = result.insertId;

  // Get the created category
  const [categories] = await pool.query(
    'SELECT id, name, icon, is_default, created_at FROM categories WHERE id = ?',
    [categoryId]
  );

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: categories[0],
  });
});
