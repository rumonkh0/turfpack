import prisma from "../db/prismaClient.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";
import config from "../config.js";

export async function checkLowStock() {
  try {
    const products = await prisma.product.findMany({ where: { status: "active" } });
    const lowStock = products.filter((p) => {
      const threshold = p.low_stock_alert !== undefined && p.low_stock_alert !== null ? p.low_stock_alert : 5;
      return p.stock <= threshold;
    });

    if (lowStock.length === 0) return;

    let msg = `📦 *Low Inventory Alert — ${config.businessName}*\n\nThe following items require restocking:\n\n`;
    for (const p of lowStock) {
      const emoji = p.stock === 0 ? "🔴 OUT OF STOCK:" : "🟡 LOW STOCK:";
      msg += `${emoji} *${p.name}* (${p.category}) — ${p.stock} ${p.unit} remaining\n`;
    }

    msg += `\nPlease arrange restocking with suppliers.`;
    await notifyAdmins(msg);
  } catch (err) {
    console.error("checkLowStock error:", err.message);
  }
}
