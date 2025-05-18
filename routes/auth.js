import express from 'express';
import {
  register,
  login,
  forgotPassword,
  GoogleAndAppleLogin,
  appleLogin,
} from '../controllers/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

router.post('/google-apple-login', GoogleAndAppleLogin);
router.post('/apple', appleLogin);
// router.post('/reset-password', resetPassword);

export default router;
