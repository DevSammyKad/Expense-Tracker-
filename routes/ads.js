import express from 'express';

import { authenticate } from '../middleware/auth.js';
import { createAds, getAds } from '../controllers/ads.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAds);
router.post('/', createAds);

export default router;
