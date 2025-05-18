import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createConnection } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/user.js';
import reportRoutes from './routes/reports.js';
import adRoutes from './routes/ads.js';
// import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
createConnection();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ads', adRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Use This if nodemon is not working
//  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
