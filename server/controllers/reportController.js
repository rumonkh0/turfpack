import asyncHandler from "../middleware/async.js";
import {
  getProfitLoss,
  getCashPosition,
  getReceivables,
  getPartnerShares,
  getDashboard,
} from "../services/reportingService.js";

export const profitLoss = asyncHandler(async (req, res) => {
  const data = getProfitLoss(req.query);
  res.status(200).json({ success: true, data });
});

export const cashPosition = asyncHandler(async (req, res) => {
  const data = getCashPosition(req.query);
  res.status(200).json({ success: true, data });
});

export const receivables = asyncHandler(async (req, res) => {
  const data = getReceivables(req.query);
  res.status(200).json({ success: true, data });
});

export const partnerShares = asyncHandler(async (req, res) => {
  const data = getPartnerShares(req.query, req.user);
  res.status(200).json({ success: true, data });
});

export const revenueBreakdown = asyncHandler(async (req, res) => {
  const pnl = getProfitLoss(req.query);
  res.status(200).json({ success: true, data: pnl.revenue });
});

export const expenseBreakdown = asyncHandler(async (req, res) => {
  const pnl = getProfitLoss(req.query);
  res.status(200).json({ success: true, data: pnl.expenses });
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = getDashboard(req.query, req.user);
  res.status(200).json({ success: true, data });
});
