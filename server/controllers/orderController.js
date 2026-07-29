import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { listRecords, createRecord, incrementColumn, findById, updateById } from "../db/sqlite.js";
import { postOrderCreated, postOrderCancelled } from "../services/ledgerPostingService.js";

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

  // Post to ledger
  try {
    let costTotal = 0;
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        if (item.product_id) {
          const product = findById("products", item.product_id);
          costTotal += (product?.cost_price || 0) * (Number(item.quantity) || 0);
        }
      }
    }
    postOrderCreated(order, costTotal, req.user?._id || null);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for order creation:", err.message);
  }

  res.status(201).json({ success: true, data: order });
});

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private/Admin
export const updateOrder = asyncHandler(async (req, res, next) => {
  let order = findById("orders", req.params.id);

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404),
    );
  }

  const oldStatus = order.status;
  order = updateById("orders", req.params.id, req.body);

  // Ledger hook: if cancelled
  if (req.body.status === "cancelled" && oldStatus !== "cancelled") {
    try {
      let costTotal = 0;
      const items = order.items || [];
      for (const item of items) {
        if (item.product_id) {
          const product = findById("products", item.product_id);
          costTotal += (product?.cost_price || 0) * (Number(item.quantity) || 0);
        }
      }
      postOrderCancelled(order, costTotal, req.user?._id || null);
    } catch (err) {
      console.error("⚠️ Ledger posting failed for order cancellation:", err.message);
    }
  }

  res.status(200).json({ success: true, data: order });
});
