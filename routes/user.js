import express from 'express';

import { authenticate } from '../middleware/auth.js';
import { UpdateUserProfile, getUsers } from '../controllers/user.js';

const router = express.Router();

router.use(authenticate);

router.put('/profile', UpdateUserProfile);
router.get('/get-all', getUsers);

export default router;
