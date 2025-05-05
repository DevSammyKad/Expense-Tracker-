import express from 'express';

import { authenticate } from '../middleware/auth.js';
import {
  createExpense,
  getMyExpenses,
  getExpensesByUserIdAdmin,
} from '../controllers/expenses.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createExpense);
router.get('/', getMyExpenses);
router.get('/:userId', getExpensesByUserIdAdmin);

export default router;
