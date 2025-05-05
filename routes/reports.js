import express from 'express';

import { authenticate } from '../middleware/auth.js';
import { getMonthlyReport } from '../controllers/reports.js';

const router = express.Router();

router.use(authenticate);

router.get('/monthly', getMonthlyReport);

export default router;
