import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";

export const getAccounts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  
  let orderBy = { code: "asc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const where = {};
  if (req.query.type) {
    where.type = req.query.type;
  }
  if (req.query.status) {
    where.status = req.query.status;
  }

  const accounts = await prisma.account.findMany({
    where,
    orderBy,
    take: limit,
  });

  res.status(200).json({ success: true, count: accounts.length, data: accounts });
});

export const createAccount = asyncHandler(async (req, res, next) => {
  const { code, name, type, normal_side, description } = req.body;

  if (!code || !name || !type || !normal_side) {
    return next(new ErrorResponse("code, name, type, and normal_side are required", 400));
  }

  const typeRanges = { asset: "1", liability: "2", equity: "3", revenue: "4", cogs: "5", expense: "6" };
  if (!typeRanges[type]) {
    return next(new ErrorResponse(`Invalid type: ${type}`, 400));
  }
  if (!code.startsWith(typeRanges[type])) {
    return next(new ErrorResponse(`Code ${code} must start with ${typeRanges[type]} for type ${type}`, 400));
  }

  const account = await prisma.account.create({
    data: {
      code,
      name,
      type,
      normal_side,
      description,
      is_system: 0,
      status: "active",
    }
  });

  res.status(201).json({ success: true, data: account });
});

export const updateAccount = asyncHandler(async (req, res, next) => {
  const account = await prisma.account.findUnique({ where: { id: req.params.id } });
  if (!account) {
    return next(new ErrorResponse("Account not found", 404));
  }

  if (account.is_system) {
    const restricted = ["code", "type", "normal_side"];
    for (const field of restricted) {
      if (req.body[field] && req.body[field] !== account[field]) {
        return next(new ErrorResponse(`Cannot change ${field} on system account`, 400));
      }
    }
  }

  const updated = await prisma.account.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.status(200).json({ success: true, data: updated });
});
