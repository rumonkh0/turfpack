import prisma from "../db/prismaClient.js";
import { getAvailableSlots, calculatePrice, createBooking, cancelBooking } from "../../server/services/bookingService.js";
import { createOrder } from "../../server/services/orderService.js";
import { getProfitLoss, getReceivables, getDashboard } from "../../server/services/reportingService.js";
import { searchKnowledge } from "../rag/retriever.js";

export async function executeTool(name, args) {
  try {
    switch (name) {
      case "check_availability": {
        if (args.turf_id) {
          const slots = await getAvailableSlots(args.turf_id, args.date);
          const turf = await prisma.turf.findUnique({ where: { id: args.turf_id } });
          return { turf: turf?.name, date: args.date, slots };
        }
        // Check all active turfs
        const turfs = await prisma.turf.findMany({ where: { status: "active" } });
        const result = [];
        for (const turf of turfs) {
          const slots = await getAvailableSlots(turf.id, args.date);
          result.push({ turf_id: turf.id, turf_name: turf.name, type: turf.type, slots });
        }
        return result;
      }

      case "get_turf_list": {
        return await prisma.turf.findMany({
          where: { status: "active" },
          select: {
            id: true,
            name: true,
            type: true,
            size: true,
            location: true,
            description: true,
            base_price: true,
            peak_price: true,
            night_price: true,
            opening_hour: true,
            closing_hour: true,
            peak_hours_start: true,
            peak_hours_end: true,
            weekend_multiplier: true,
            amenities: true,
          },
        });
      }

      case "get_pricing":
        return {
          price: await calculatePrice(args.turf_id, args.date, Number(args.start_hour), Number(args.end_hour)),
        };

      case "create_booking":
        return await createBooking(args, null);

      case "get_bookings_by_phone": {
        const where = { customer_phone: { contains: args.phone } };
        if (args.status && args.status !== "all") where.status = args.status;
        return await prisma.booking.findMany({
          where,
          orderBy: { date: "desc" },
          take: 10,
        });
      }

      case "cancel_booking":
        return await cancelBooking(args.booking_id, null);

      case "list_products": {
        const where = { status: "active" };
        if (args.category) where.category = args.category;
        return await prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
            stock: true,
            unit: true,
            description: true,
          },
        });
      }

      case "create_order":
        return await createOrder(args, null);

      case "get_tournaments": {
        const where = {};
        if (args.status && args.status !== "all") where.status = args.status;
        return await prisma.tournament.findMany({
          where,
          orderBy: { created_at: "desc" },
        });
      }

      case "get_dashboard":
        return await getDashboard(args || {}, { role: "admin" });

      case "get_profit_loss":
        return await getProfitLoss(args || {});

      case "get_receivables":
        return await getReceivables({});

      case "search_knowledge":
        return await searchKnowledge(args.query);

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`Tool execution error for ${name}:`, err.message);
    return { error: err.message };
  }
}
