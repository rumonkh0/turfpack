import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { listRecords, findById, createRecord, updateById } from "../db/sqlite.js";

export const getAccounts = asyncHandler(async (req, res) => {
  const where = [];
  const params = [];

  if (req.query.type) {
    where.push("type = ?");
    params.push(req.query.type);
  }
  if (req.query.status) {
    where.push("status = ?");
    params.push(req.query.status);
  }

  const accounts = listRecords("accounts", {
    sort: req.query.sort || "code",
    limit: parseInt(req.query.limit, 10) || 500,
    where: where.join(" AND "),
    params,
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

  const account = createRecord("accounts", {
    code, name, type, normal_side, description, is_system: 0, status: "active",
  });

  res.status(201).json({ success: true, data: account });
});

export const updateAccount = asyncHandler(async (req, res, next) => {
  const account = findById("accounts", req.params.id);
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

  const updated = updateById("accounts", req.params.id, req.body);
  res.status(200).json({ success: true, data: updated });
});
