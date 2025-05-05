import { getPool } from '../config/db.js';
import { catchAsync, AppError } from '../middleware/errorHandler.js';

export const createExpense = catchAsync(async (req, res) => {
  const {
    title,
    amount,
    payment_date,
    payment_method = 'cash',
    notes,
    category_id,
  } = req.body;
  const userId = req.user.id;

  console.log('Creating expense:', req.user);

  // Basic validation
  if (!title || !amount || !payment_date || !category_id) {
    throw new AppError(
      'Please provide all required fields: title, amount, payment_date, category_id',
      400
    );
  }

  const pool = getPool();

  // Optional: check if the category exists for the user
  const [categoryCheck] = await pool.query(
    'SELECT id FROM categories WHERE id = ? AND (user_id = ? OR is_default = true)',
    [category_id, userId]
  );

  if (categoryCheck.length === 0) {
    throw new AppError('Invalid category for this user', 400);
  }

  // Insert expense
  const [result] = await pool.query(
    `INSERT INTO expenses 
     (title, amount, payment_date, payment_method, notes, category_id, user_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      amount,
      payment_date,
      payment_method,
      notes || null,
      category_id,
      userId,
    ]
  );

  // Fetch created expense
  const [expense] = await pool.query('SELECT * FROM expenses WHERE id = ?', [
    result.insertId,
  ]);

  res.status(201).json({
    success: true,
    message: 'Expense created successfully',
    data: expense[0],
  });
});

export const getMyExpenses = catchAsync(async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    throw new AppError('Unauthorized: User ID not found', 401);
  }

  const pool = getPool();

  const [expenses] = await pool.query(
    `
    SELECT 
      e.id, e.title, e.amount, e.payment_date, e.payment_method, 
      e.notes, e.category_id, c.name AS category_name, e.created_at, e.updated_at
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ?
    ORDER BY e.created_at DESC
    `,
    [userId]
  );

  res.status(200).json({
    success: true,
    message: 'User expenses fetched successfully',
    data: expenses,
  });
});

export const getExpensesByUserIdAdmin = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const pool = getPool();

  const [expenses] = await pool.query(
    `SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  res.status(200).json({
    success: true,
    message: 'Expenses retrieved successfully for the given user',
    data: expenses,
  });
});
