import express from 'express';

import { authenticate } from '../middleware/auth.js';
import { createCategory, getCategories } from '../controllers/categories.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', createCategory);

export default router;
