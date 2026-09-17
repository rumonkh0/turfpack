import prisma from "../db/prismaClient.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";
import config from "../config.js";

/**
 * Check for low or depleted product stock and notify admins.
 */
export async function checkLowStock() {
  try {
    const products = await prisma.product.findMany({ where: { status: "active" } });
    const lowStock = products.filter((p) => {
      const threshold = p.low_stock_alert !== undefined && p.low_stock_alert !== null ? p.low_stock_alert : 5;
      return p.stock <= threshold;
    });

    if (lowStock.length === 0) return [];

    let msg = `📦 *Low Inventory Alert — ${config.businessName}*\n\nThe following items require attention:\n\n`;
    for (const p of lowStock) {
      const emoji = p.stock === 0 ? "🔴 OUT OF STOCK:" : "🟡 LOW STOCK:";
      msg += `${emoji} *${p.name}* (${p.category}) — ${p.stock} ${p.unit} remaining (Threshold: ${p.low_stock_alert || 5})\n`;
    }

    msg += `\nPlease arrange restocking with suppliers.`;
    await notifyAdmins(msg);
    return lowStock;
  } catch (err) {
    console.error("checkLowStock error:", err.message);
    return [];
  }
}

/**
 * Calculate product sales run-rate and estimated days until stockout.
 * @param {number} [lookbackDays=14]
 */
export async function calculateStockVelocity(lookbackDays = 14) {
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  try {
    const [products, orders] = await Promise.all([
      prisma.product.findMany({ where: { status: "active" } }),
      prisma.order.findMany({
        where: { created_at: { gte: sinceDate } },
      }),
    ]);

    // Aggregate items sold per product
    const salesMap = new Map();
    for (const order of orders) {
      let items = order.items;
      if (typeof items === "string") {
        try {
          items = JSON.parse(items);
        } catch {
          items = [];
        }
      }
      if (Array.isArray(items)) {
        for (const item of items) {
          const pid = item.product_id || item.id;
          const qty = Number(item.quantity) || 1;
          salesMap.set(pid, (salesMap.get(pid) || 0) + qty);
        }
      }
    }

    const velocityReport = products.map((p) => {
      const sold = salesMap.get(p.id) || 0;
      const dailyRunRate = parseFloat((sold / lookbackDays).toFixed(2));
      const daysUntilStockout = dailyRunRate > 0 ? Math.floor(p.stock / dailyRunRate) : 999;
      // Recommended 2-week buffer
      const targetStock = Math.ceil(dailyRunRate * 14);
      const recommendedReorder = Math.max(0, targetStock - p.stock);

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        currentStock: p.stock,
        unit: p.unit,
        soldLast14Days: sold,
        dailyRunRate,
        daysUntilStockout: daysUntilStockout > 365 ? "30+ days" : `${daysUntilStockout} days`,
        numericDays: daysUntilStockout,
        recommendedReorder,
      };
    });

    // Sort by urgency: lowest days first
    velocityReport.sort((a, b) => a.numericDays - b.numericDays);
    return velocityReport;
  } catch (err) {
    console.error("calculateStockVelocity error:", err.message);
    return [];
  }
}

/**
 * Generate and send weekly restocking velocity report to admins.
 */
export async function generateRestockReport() {
  try {
    const report = await calculateStockVelocity(14);
    const criticalItems = report.filter((r) => r.numericDays <= 7 || r.currentStock <= 5);

    if (criticalItems.length === 0) {
      return { report, criticalCount: 0 };
    }

    let msg = `📊 *Weekly Inventory Restock & Velocity Report*\n\n`;
    for (const item of criticalItems) {
      const urgency = item.currentStock === 0 ? "🔴 OUT OF STOCK" : item.numericDays <= 3 ? "⚠️ CRITICAL" : "🟡 LOW";
      msg += `*${item.name}* [${urgency}]\n`;
      msg += `• Current Stock: ${item.currentStock} ${item.unit}\n`;
      msg += `• Daily Run-Rate: ~${item.dailyRunRate} / day\n`;
      msg += `• Estimated Stockout: in *${item.daysUntilStockout}*\n`;
      if (item.recommendedReorder > 0) {
        msg += `• Recommended Reorder: *+${item.recommendedReorder} ${item.unit}*\n`;
      }
      msg += `\n`;
    }

    await notifyAdmins(msg);
    return { report, criticalCount: criticalItems.length };
  } catch (err) {
    console.error("generateRestockReport error:", err.message);
    return null;
  }
}

/**
 * Record a restock delivery for a product.
 */
export async function recordRestock({ productId, productName, quantity, costPrice, supplierNote }) {
  let product = null;

  if (productId) {
    product = await prisma.product.findUnique({ where: { id: productId } });
  }
  if (!product && productName) {
    product = await prisma.product.findFirst({
      where: { name: { contains: productName } },
    });
  }

  if (!product) {
    throw new Error(`Product not found: ${productName || productId}`);
  }

  const addQty = Number(quantity);
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      stock: { increment: addQty },
      ...(costPrice !== undefined ? { cost_price: Number(costPrice) } : {}),
    },
  });

  const alert =
    `📥 *Stock Replenished — ${config.businessName}*\n` +
    `Product: *${updated.name}*\n` +
    `Added: *+${addQty} ${updated.unit}*\n` +
    `New Stock: *${updated.stock} ${updated.unit}*\n` +
    (supplierNote ? `Note: ${supplierNote}\n` : "");

  await notifyAdmins(alert);
  return updated;
}
