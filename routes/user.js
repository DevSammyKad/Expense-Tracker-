import express from 'express';

import { authenticate } from '../middleware/auth.js';
import {
  UpdateUserProfile,
  getUser,
  getUserTransactions,
  getUsers,
  usersCount,
} from '../controllers/user.js';

const router = express.Router();

router.use(authenticate);

router.put('/profile', UpdateUserProfile);
router.get('/get-all', getUsers);
router.get('/get-count', usersCount);
router.get('/get-transactions/:id', getUserTransactions);
//  curl for this endpoint is

router.get('/get-user/:id', getUser);

export default router;
