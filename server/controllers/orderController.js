import asyncHandler from "../middleware/async.js";
import { listRecords, createRecord, incrementColumn } from "../db/sqlite.js";

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = asyncHandler(async (req, res, next) => {
  const orders = listRecords("orders", {
    sort: req.query.sort || "-createdAt",
    limit: parseInt(req.query.limit, 10) || 500,
  });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = asyncHandler(async (req, res, next) => {
  const order = createRecord("orders", req.body);

  // Update stock for each product
  if (req.body.items && Array.isArray(req.body.items)) {
    for (const item of req.body.items) {
      if (item.product_id) {
        incrementColumn(
          "products",
          item.product_id,
          "stock",
          -(Number(item.quantity) || 0),
        );
      }
    }
  }

  res.status(201).json({ success: true, data: order });
});
