import { getPool } from '../config/db.js';
import { catchAsync } from '../middleware/errorHandler.js';

export const getMonthlyReport = catchAsync(async (req, res) => {
  const userId = req.user.id; // from JWT middleware
  const pool = await getPool();

  // 1. Total Expenses
  const [totalRows] = await pool.query(
    `
    SELECT IFNULL(SUM(amount), 0) AS totalExpenses
    FROM expenses
    WHERE user_id = ?
      AND MONTH(payment_date) = MONTH(CURRENT_DATE())
      AND YEAR(payment_date) = YEAR(CURRENT_DATE())
  `,
    [userId]
  );

  const totalExpenses = totalRows[0].totalExpenses;

  console.log('Total expenses:', totalExpenses);

  // 2. Payment History grouped by DATE
  const [rows] = await pool.query(
    `
    SELECT 
      DATE(payment_date) AS paymentGroupDate,
      title,
      category_id,
      payment_method,
      amount,
      DATE_FORMAT(payment_date, '%d %M %Y') AS formattedDate
    FROM expenses
    WHERE user_id = ?
      AND MONTH(payment_date) = MONTH(CURRENT_DATE())
      AND YEAR(payment_date) = YEAR(CURRENT_DATE())
    ORDER BY paymentGroupDate DESC, payment_date DESC
  `,
    [userId]
  );

  // Grouping by date
  const grouped = rows.reduce((acc, row) => {
    const dateKey = row.paymentGroupDate;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push({
      title: row.title,
      paymentMethod: row.payment_method,
      amount: row.amount,
      paymentDate: row.formattedDate,
      categoryId: row.category_id,
      //   categoryImage: row.category_image,
    });
    return acc;
  }, {});

  const report = Object.entries(grouped).map(([date, entries]) => ({
    date,
    entries,
  }));

  res.json({
    totalExpenses,
    report,
  });
});

export const getDailyReport = catchAsync(async (req, res) => {
  const userId = req.user.id; // from JWT middleware
  const pool = await getPool();

  // Get date from query parameter (e.g., ?date=2025-05-12) or default to today
  const dateParam = req.query.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDate = new Date(dateParam);

  // Validate date format
  if (isNaN(reportDate.getTime())) {
    return res
      .status(400)
      .json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // 1. Total Expenses for the specified day
  const [totalRows] = await pool.query(
    `
    SELECT IFNULL(SUM(amount), 0) AS totalExpenses
    FROM expenses
    WHERE user_id = ?
      AND DATE(payment_date) = ?
  `,
    [userId, dateParam]
  );

  const totalExpenses = totalRows[0].totalExpenses;

  console.log(`Total expenses for ${dateParam}:`, totalExpenses);

  // 2. Payment History for the specified day
  const [rows] = await pool.query(
    `
    SELECT 
      DATE(payment_date) AS paymentGroupDate,
      title,
      category_id,
      payment_method,
      amount,
      DATE_FORMAT(payment_date, '%d %M %Y %H:%i') AS formattedDate
    FROM expenses
    WHERE user_id = ?
      AND DATE(payment_date) = ?
    ORDER BY payment_date DESC
  `,
    [userId, dateParam]
  );

  // Transform rows into report entries (no grouping needed for a single day)
  const report = rows.map((row) => ({
    date: row.paymentGroupDate,
    entries: [
      {
        title: row.title,
        paymentMethod: row.payment_method,
        amount: row.amount,
        paymentDate: row.formattedDate,
        categoryId: row.category_id,
        // categoryImage: row.category_image, // Uncomment if needed
      },
    ],
  }));

  res.json({
    totalExpenses,
    report: report.length > 0 ? report : [], // Return empty array if no expenses
  });
});
