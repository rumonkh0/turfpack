import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { findById, createRecord, updateById, listRecords, getDatabase } from "../db/sqlite.js";
import { getCurrentShares, reallocateShares, assignInitialShare, getShareHistory } from "../services/profitShareService.js";
import { postPartnerPayout } from "../services/ledgerPostingService.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const getPartners = asyncHandler(async (req, res) => {
  const db = getDatabase();
  const partners = db.prepare(`
    SELECT u.id as _id, u.id, u.full_name, u.email, u.role, u.status, u.created_at,
           psr.share_bp
    FROM users u
    LEFT JOIN profit_share_ratios psr ON psr.user_id = u.id AND psr.effective_to IS NULL
    WHERE u.role = 'partner'
    ORDER BY u.full_name
  `).all();

  const data = partners.map((p) => ({
    ...p,
    createdAt: p.created_at,
    share_bp: p.share_bp || 0,
    share_pct: (p.share_bp || 0) / 100,
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

export const getPartner = asyncHandler(async (req, res, next) => {
  const user = findById("users", req.params.id);
  if (!user || user.role !== "partner") {
    return next(new ErrorResponse("Partner not found", 404));
  }

  const shares = getCurrentShares();
  const share = shares.find((s) => s.user_id === req.params.id);

  res.status(200).json({
    success: true,
    data: {
      ...user,
      share_bp: share?.share_bp || 0,
      share_pct: (share?.share_bp || 0) / 100,
    },
  });
});

export const createPartner = asyncHandler(async (req, res, next) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return next(new ErrorResponse("full_name, email, and password are required", 400));
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const partner = createRecord("users", {
    full_name,
    email,
    password: hashedPassword,
    role: "partner",
    status: "active",
  });

  const currentShares = getCurrentShares();
  let shareInfo = { share_bp: 0, share_pct: 0 };

  if (currentShares.length === 0) {
    assignInitialShare(partner._id);
    shareInfo = { share_bp: 10000, share_pct: 100 };
  }

  res.status(201).json({
    success: true,
    data: { ...partner, ...shareInfo },
  });
});

export const updatePartner = asyncHandler(async (req, res, next) => {
  const user = findById("users", req.params.id);
  if (!user || user.role !== "partner") {
    return next(new ErrorResponse("Partner not found", 404));
  }

  const updateData = {};
  if (req.body.full_name) updateData.full_name = req.body.full_name;
  if (req.body.email) updateData.email = req.body.email;
  if (req.body.status) updateData.status = req.body.status;
  if (req.body.password) updateData.password = bcrypt.hashSync(req.body.password, 10);

  const updated = updateById("users", req.params.id, updateData);

  const shares = getCurrentShares();
  const share = shares.find((s) => s.user_id === req.params.id);

  res.status(200).json({
    success: true,
    data: {
      ...updated,
      share_bp: share?.share_bp || 0,
      share_pct: (share?.share_bp || 0) / 100,
    },
  });
});

export const reallocate = asyncHandler(async (req, res, next) => {
  const { shares, reason } = req.body;
  if (!shares || !Array.isArray(shares)) {
    return next(new ErrorResponse("shares array is required", 400));
  }

  try {
    const result = reallocateShares(shares, req.user._id, reason);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(new ErrorResponse(err.message, 400));
  }
});

export const sharesHistory = asyncHandler(async (req, res) => {
  const history = getShareHistory(parseInt(req.query.limit, 10) || 20);
  res.status(200).json({ success: true, count: history.length, data: history });
});

export const getPayouts = asyncHandler(async (req, res) => {
  const db = getDatabase();
  const where = ["je.reference_type = 'payout'"];
  const params = [];

  if (req.query.user_id) { where.push("je.created_by = ?"); params.push(req.query.user_id); }
  if (req.query.from) { where.push("je.entry_date >= ?"); params.push(req.query.from); }
  if (req.query.to) { where.push("je.entry_date <= ?"); params.push(req.query.to); }

  const rows = db.prepare(`
    SELECT je.id as _id, je.id, je.reference_id, je.entry_date, je.description, je.created_by as user_id,
           u.full_name as partner_name, je.created_at,
           (SELECT jl.debit FROM journal_lines jl WHERE jl.journal_entry_id = je.id AND jl.account_code = '3100') as amount,
           (SELECT jl.account_code FROM journal_lines jl WHERE jl.journal_entry_id = je.id AND jl.account_code != '3100' LIMIT 1) as payment_account
    FROM journal_entries je
    LEFT JOIN users u ON u.id = je.created_by
    WHERE ${where.join(" AND ")}
    ORDER BY je.created_at DESC
    LIMIT ?
  `).all(...params, parseInt(req.query.limit, 10) || 50);

  const data = rows.map((r) => ({
    ...r,
    createdAt: r.created_at,
    amount: r.amount || 0,
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

export const createPayout = asyncHandler(async (req, res, next) => {
  const { user_id, amount, payment_method, notes } = req.body;
  if (!user_id || !amount || !payment_method) {
    return next(new ErrorResponse("user_id, amount, and payment_method are required", 400));
  }

  const partner = findById("users", user_id);
  if (!partner || partner.role !== "partner") {
    return next(new ErrorResponse("Partner not found", 404));
  }

  const payoutId = crypto.randomUUID();
  const entryDate = new Date().toISOString().slice(0, 10);

  postPartnerPayout(payoutId, partner, amount, payment_method, entryDate, req.user._id);

  res.status(201).json({
    success: true,
    data: {
      _id: payoutId,
      user_id,
      partner_name: partner.full_name,
      amount,
      payment_method,
      notes: notes || null,
      entry_date: entryDate,
      createdAt: new Date().toISOString(),
    },
  });
});
