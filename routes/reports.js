import express from 'express';

import { authenticate } from '../middleware/auth.js';
import { getDailyReport, getMonthlyReport } from '../controllers/reports.js';

const router = express.Router();

router.use(authenticate);

router.get('/monthly', getMonthlyReport);
router.get('/daily', getDailyReport);

export default router;
