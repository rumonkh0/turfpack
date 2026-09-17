import prisma from "../db/prismaClient.js";
import { postOrderCreated } from "./ledgerPostingService.js";

/**
 * Create an order with stock update and ledger posting.
 * @param {object} data - { items: [{product_id, quantity}], customer_name?, customer_phone?, payment_method?, payment_status?, total_amount? }
 * @param {string|null} createdBy
 * @returns {Promise<object>} created order
 */
export async function createOrder(data, createdBy = null) {
  let totalAmount = 0;
  let costTotal = 0;
  const enrichedItems = [];

  const items = data.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.product_id } });
    if (!product) throw new Error(`Product not found: ${item.product_id}`);
    const qty = Number(item.quantity) || 1;
    if (product.stock < qty) {
      throw new Error(`Insufficient stock for ${product.name}: ${product.stock} available`);
    }

    const price = item.price !== undefined ? Number(item.price) : product.price;
    const lineTotal = price * qty;
    totalAmount += lineTotal;
    costTotal += (product.cost_price || 0) * qty;

    enrichedItems.push({
      product_id: product.id,
      name: product.name,
      price: price,
      quantity: qty,
      total: lineTotal,
    });
  }

  const finalTotal = data.total_amount !== undefined ? Number(data.total_amount) : totalAmount;

  const order = await prisma.order.create({
    data: {
      customer_name: data.customer_name || "Walk-in",
      customer_phone: data.customer_phone || null,
      items: enrichedItems,
      total_amount: finalTotal,
      status: data.status || "confirmed",
      payment_method: data.payment_method || "cash",
      payment_status: data.payment_status || "paid",
    },
  });

  // Decrement stock
  for (const item of enrichedItems) {
    await prisma.product.update({
      where: { id: item.product_id },
      data: { stock: { decrement: item.quantity } },
    });
  }

  // Ledger posting
  try {
    await postOrderCreated(order, costTotal, createdBy);
  } catch (err) {
    console.error("⚠️ Ledger posting failed for order creation:", err.message);
  }

  return order;
}
