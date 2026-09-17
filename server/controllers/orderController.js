import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";
import { postOrderCreated, postOrderCancelled } from "../services/ledgerPostingService.js";
import { createOrder as createOrderService } from "../services/orderService.js";

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const orders = await prisma.order.findMany({
    orderBy,
    take: limit,
  });

  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = asyncHandler(async (req, res, next) => {
  try {
    const order = await createOrderService(req.body, req.user?._id || null);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    return next(new ErrorResponse(err.message, 400));
  }
});

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private/Admin
export const updateOrder = asyncHandler(async (req, res, next) => {
  let order = await prisma.order.findUnique({ where: { id: req.params.id } });

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404),
    );
  }

  const oldStatus = order.status;
  order = await prisma.order.update({
    where: { id: req.params.id },
    data: req.body,
  });

  // Ledger hook: if cancelled
  if (req.body.status === "cancelled" && oldStatus !== "cancelled") {
    try {
      let costTotal = 0;
      const items = order.items || [];
      for (const item of items) {
        if (item.product_id) {
          const product = await prisma.product.findUnique({ where: { id: item.product_id } });
          costTotal += (product?.cost_price || 0) * (Number(item.quantity) || 0);
        }
      }
      await postOrderCancelled(order, costTotal, req.user?._id || null);
    } catch (err) {
      console.error("⚠️ Ledger posting failed for order cancellation:", err.message);
    }
  }

  res.status(200).json({ success: true, data: order });
});
