import { getPool } from '../config/db.js';
import { catchAsync } from '../middleware/errorHandler.js';

export const createAds = catchAsync(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Ads created successfully',
    data: req.body,
  });
});

export const getAds = catchAsync(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Ads fetched successfully',
    data: req.body,
  });
});
