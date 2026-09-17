# TurfSlot AI CEO Agent — Implementation Specification

> **Purpose**: This document is a complete, step-by-step implementation specification and architectural blueprint. Any AI coding assistant (Gemini, Claude, GPT) can read this and build/maintain the entire system.

## Context: What Already Exists

The TurfSlot project is at `/media/rumon/PLANT/nivrosys/TurfSlot/` (or wherever the repo is cloned). It's a monorepo:

```
TurfSlot/
├── client/          # Vite + React frontend
├── server/          # Express API (port 5000)
│   ├── prisma/schema.prisma   # MySQL schema (14 models)
│   ├── controllers/           # 16 REST controllers
│   ├── services/              # ledgerPostingService, reportingService, profitShareService
│   ├── middleware/auth.js     # JWT auth (protect, authorize)
│   ├── routes/                # 16 route files
│   ├── db/prismaClient.js     # Prisma client singleton
│   ├── app.js                 # Express app
│   └── server.js              # Entry point (port 5000)
├── desktop/         # Electron shell
└── package.json     # Root monorepo
```

**Database**: MySQL at `DATABASE_URL` in `server/.env`
**Key tables**: users, turfs, bookings, payments, products, orders, tournaments, accounts, journal_entries, journal_lines, expenses, incomes, profit_share_ratios, app_settings
**Currency**: Bangladeshi Taka (৳). Ledger stores amounts in poisha (1 taka = 100 poisha).
**Payment methods**: bkash, nagad, rocket, cash, card

---

## STEP 0: Pre-Implementation — Extract Shared Business Logic

Before building the AI agent, extract business logic from controllers into reusable service functions that both the API and the AI agent will use.

### [NEW] `server/services/bookingService.js`

Extract from `server/controllers/bookingController.js`:

```javascript
import prisma from "../db/prismaClient.js";
import { postBookingCreated, postBookingInstallment, postBookingCancelled, postBookingRefund } from "./ledgerPostingService.js";

/**
 * Check if a time slot conflicts with existing bookings.
 * @param {string} turfId
 * @param {string} date - YYYY-MM-DD
 * @param {number} startHour
 * @param {number} endHour
 * @returns {object|null} - Conflicting booking or null
 */
export async function checkSlotConflict(turfId, date, startHour, endHour) {
  return await prisma.booking.findFirst({
    where: {
      turf_id: turfId,
      date: date,
      status: { not: "cancelled" },
      start_hour: { lt: endHour },
      end_hour: { gt: startHour },
    },
  });
}

/**
 * Get available slots for a turf on a date.
 * @param {string} turfId
 * @param {string} date - YYYY-MM-DD
 * @returns {Array<{start_hour: number, end_hour: number, available: boolean, price: number}>}
 */
export async function getAvailableSlots(turfId, date) {
  const turf = await prisma.turf.findUnique({ where: { id: turfId } });
  if (!turf) return [];

  const bookings = await prisma.booking.findMany({
    where: { turf_id: turfId, date, status: { not: "cancelled" } },
    select: { start_hour: true, end_hour: true },
  });

  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat in BD

  const slots = [];
  for (let h = turf.opening_hour; h < turf.closing_hour; h++) {
    const isBooked = bookings.some((b) => b.start_hour < h + 1 && b.end_hour > h);
    let price = turf.base_price;
    if (h >= turf.peak_hours_start && h < turf.peak_hours_end) price = turf.peak_price;
    else if (h >= 21) price = turf.night_price;
    if (isWeekend) price = Math.round(price * turf.weekend_multiplier);

    slots.push({ start_hour: h, end_hour: h + 1, available: !isBooked, price });
  }
  return slots;
}

/**
 * Calculate price for a booking.
 * @param {string} turfId
 * @param {string} date
 * @param {number} startHour
 * @param {number} endHour
 * @returns {number} total price in taka
 */
export async function calculatePrice(turfId, date, startHour, endHour) {
  const turf = await prisma.turf.findUnique({ where: { id: turfId } });
  if (!turf) throw new Error("Turf not found");

  const dayOfWeek = new Date(date).getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  let total = 0;

  for (let h = startHour; h < endHour; h++) {
    let price = turf.base_price;
    if (h >= turf.peak_hours_start && h < turf.peak_hours_end) price = turf.peak_price;
    else if (h >= 21) price = turf.night_price;
    if (isWeekend) price = Math.round(price * turf.weekend_multiplier);
    total += price;
  }
  return total;
}

/**
 * Create a booking with payment and ledger posting.
 * @param {object} data - { turf_id, date, start_hour, end_hour, customer_name, customer_phone, customer_email?, payment_method?, paid_amount?, payment_status? }
 * @param {string|null} createdBy - user ID
 * @returns {object} created booking
 */
export async function createBooking(data, createdBy = null) {
  const turf = await prisma.turf.findUnique({ where: { id: data.turf_id } });
  if (!turf) throw new Error(`Turf not found: ${data.turf_id}`);

  const startHour = Number(data.start_hour);
  const endHour = Number(data.end_hour || startHour + 1);

  const conflict = await checkSlotConflict(data.turf_id, data.date, startHour, endHour);
  if (conflict) throw new Error("Time slot already booked");

  const totalPrice = data.total_price || (await calculatePrice(data.turf_id, data.date, startHour, endHour));
  const paidAmount = Number(data.paid_amount || 0);
  const paymentStatus = data.payment_status || (paidAmount >= totalPrice ? "paid" : paidAmount > 0 ? "partial" : "unpaid");

  const booking = await prisma.booking.create({
    data: {
      turf_id: data.turf_id,
      turf_name: turf.name,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email || null,
      date: data.date,
      start_hour: startHour,
      end_hour: endHour,
      duration_hours: endHour - startHour,
      total_price: totalPrice,
      paid_amount: paidAmount,
      status: "confirmed",
      payment_status: paymentStatus,
      payment_method: data.payment_method || "bkash",
      txn_id: data.txn_id || null,
      notes: data.notes || null,
    },
  });

  if (["paid", "partial"].includes(paymentStatus) && paidAmount > 0) {
    await prisma.payment.create({
      data: {
        booking_id: booking.id,
        amount: paymentStatus === "paid" ? totalPrice : paidAmount,
        status: "completed",
        method: data.payment_method || "bkash",
        transaction_id: data.txn_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
      },
    });
  }

  try {
    await postBookingCreated(booking, createdBy);
  } catch (err) {
    console.error("Ledger posting failed:", err.message);
  }

  return booking;
}

/**
 * Cancel a booking with ledger posting.
 */
export async function cancelBooking(bookingId, createdBy = null) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "cancelled") throw new Error("Booking already cancelled");

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
  });

  try {
    if (booking.payment_status === "unpaid") {
      await postBookingCancelled(updated, createdBy);
    } else {
      await postBookingRefund(updated, createdBy);
    }
  } catch (err) {
    console.error("Ledger posting failed:", err.message);
  }

  return updated;
}
```

### [NEW] `server/services/orderService.js`

Extract from `server/controllers/orderController.js`:

```javascript
import prisma from "../db/prismaClient.js";
import { postOrderCreated } from "./ledgerPostingService.js";

/**
 * Create an order with stock update and ledger posting.
 * @param {object} data - { items: [{product_id, quantity}], customer_name?, customer_phone?, payment_method? }
 * @param {string|null} createdBy
 * @returns {object} created order
 */
export async function createOrder(data, createdBy = null) {
  // Validate stock and calculate totals
  let totalAmount = 0;
  let costTotal = 0;
  const enrichedItems = [];

  for (const item of data.items) {
    const product = await prisma.product.findUnique({ where: { id: item.product_id } });
    if (!product) throw new Error(`Product not found: ${item.product_id}`);
    if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}: ${product.stock} available`);

    const lineTotal = product.price * item.quantity;
    totalAmount += lineTotal;
    costTotal += product.cost_price * item.quantity;
    enrichedItems.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      total: lineTotal,
    });
  }

  const order = await prisma.order.create({
    data: {
      customer_name: data.customer_name || "Walk-in",
      customer_phone: data.customer_phone || null,
      items: enrichedItems,
      total_amount: totalAmount,
      status: "confirmed",
      payment_method: data.payment_method || "cash",
      payment_status: "paid",
    },
  });

  // Decrement stock
  for (const item of data.items) {
    await prisma.product.update({
      where: { id: item.product_id },
      data: { stock: { decrement: item.quantity } },
    });
  }

  try {
    await postOrderCreated(order, costTotal, createdBy);
  } catch (err) {
    console.error("Ledger posting failed:", err.message);
  }

  return order;
}
```

### [MODIFY] `server/controllers/bookingController.js`

Refactor `createBooking` controller to use the new service:

```javascript
import { createBooking as createBookingService, cancelBooking as cancelBookingService } from "../services/bookingService.js";

export const createBooking = asyncHandler(async (req, res, next) => {
  try {
    const booking = await createBookingService(req.body, req.user?._id || null);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    return next(new ErrorResponse(err.message, 400));
  }
});
```

*(Similar refactor for orderController.js)*

---

## STEP 1: Project Setup

### Create the `ai-agent/` directory

```bash
mkdir -p TurfSlot/ai-agent
cd TurfSlot/ai-agent
```

### [NEW] `ai-agent/package.json`

```json
{
  "name": "turfslot-ai-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@prisma/client": "^5.21.1",
    "openai": "^4.73.0",
    "whatsapp-web.js": "^1.26.0",
    "qrcode-terminal": "^0.12.0",
    "node-cron": "^3.0.3",
    "express": "^4.19.2",
    "dotenv": "^16.4.5",
    "telegraf": "^4.16.3",
    "prisma": "^5.21.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.2"
  }
}
```

### [NEW] `ai-agent/.env`

```env
# Database (same as server)
DATABASE_URL="mysql://rumontop_myuser:RumonDB123@122.173.84.249:3306/rumontop_turfslot"

# AI Providers (multi-provider: set the ones you have)
GEMINI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
AI_PROVIDER=gemini  # gemini | openai | deepseek

# WhatsApp
WHATSAPP_MODE=unofficial  # official | unofficial
# Official (Meta Cloud API)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=turfslot_verify_2026
WHATSAPP_BUSINESS_ACCOUNT_ID=
# Unofficial (whatsapp-web.js) — no config needed, scans QR

# Telegram (admin alerts)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_IDS=  # comma-separated

# Agent Config
AGENT_PORT=5001
ADMIN_PHONE_NUMBERS=8801XXXXXXXXX  # comma-separated
BUSINESS_NAME=TurfSlot Sports Complex
CURRENCY=৳
TIMEZONE=Asia/Dhaka
```

### [NEW] `ai-agent/prisma/schema.prisma`

This should be a **symlink** to `server/prisma/schema.prisma` PLUS the new models. The simplest approach: copy the schema and add new models.

Add these models to the existing schema:

```prisma
model CustomerProfile {
  id              String   @id @default(uuid())
  phone_number    String   @unique
  name            String?
  total_bookings  Int      @default(0)
  total_spent     Float    @default(0)
  preferred_turf  String?
  preferred_time  String?
  segment         String   @default("new")
  last_visit      String?
  notes           String?  @db.Text
  created_at      DateTime @default(now())
  @@map("customer_profiles")
}

model WhatsAppSession {
  id            String   @id @default(uuid())
  phone_number  String   @unique
  customer_name String?
  context       String?  @db.Text
  state         String   @default("idle")
  last_active   DateTime @default(now())
  created_at    DateTime @default(now())
  @@map("whatsapp_sessions")
}

model AgentLog {
  id            String   @id @default(uuid())
  phone_number  String?
  channel       String   @default("whatsapp")
  direction     String
  message       String?  @db.Text
  intent        String?
  tools_used    String?  @db.Text
  ai_response   String?  @db.Text
  tokens_used   Int?
  latency_ms    Int?
  created_at    DateTime @default(now())
  @@index([phone_number, created_at])
  @@index([channel, created_at])
  @@map("agent_logs")
}

model AutomationRule {
  id          String    @id @default(uuid())
  name        String
  trigger     String
  action      String    @db.Text
  enabled     Int       @default(1)
  last_run    DateTime?
  run_count   Int       @default(0)
  created_at  DateTime  @default(now())
  @@map("automation_rules")
}
```

After adding these, run `npx prisma db push` from `ai-agent/` (or `server/`) to create the tables.

---

## STEP 2: Core Infrastructure

### [NEW] `ai-agent/db/prismaClient.js`

```javascript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export default prisma;
```

### [NEW] `ai-agent/config.js`

```javascript
import "dotenv/config";

export default {
  port: parseInt(process.env.AGENT_PORT || "5001"),
  aiProvider: process.env.AI_PROVIDER || "gemini",
  whatsappMode: process.env.WHATSAPP_MODE || "unofficial",
  businessName: process.env.BUSINESS_NAME || "TurfSlot Sports Complex",
  currency: process.env.CURRENCY || "৳",
  timezone: process.env.TIMEZONE || "Asia/Dhaka",
  adminPhones: (process.env.ADMIN_PHONE_NUMBERS || "").split(",").filter(Boolean),
  telegramAdminChatIds: (process.env.TELEGRAM_ADMIN_CHAT_IDS || "").split(",").filter(Boolean),
  gemini: { apiKey: process.env.GEMINI_API_KEY },
  openai: { apiKey: process.env.OPENAI_API_KEY },
  deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
  whatsapp: {
    official: {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    },
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
};
```

---

## STEP 3: Multi-Provider AI Brain

### [NEW] `ai-agent/core/providers/geminiProvider.js`

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../../config.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export async function chat(messages, tools, systemPrompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    tools: tools ? [{ functionDeclarations: tools }] : undefined,
  });

  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  // Check for function calls
  const functionCalls = response.candidates?.[0]?.content?.parts
    ?.filter((p) => p.functionCall)
    ?.map((p) => ({
      name: p.functionCall.name,
      arguments: p.functionCall.args,
    }));

  if (functionCalls && functionCalls.length > 0) {
    return { type: "function_call", calls: functionCalls };
  }

  return { type: "text", content: response.text() };
}

export async function embed(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
```

### [NEW] `ai-agent/core/providers/openaiProvider.js`

```javascript
import OpenAI from "openai";
import config from "../../config.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function chat(messages, tools, systemPrompt) {
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const params = {
    model: "gpt-4o-mini",
    messages: formattedMessages,
  };

  if (tools && tools.length > 0) {
    params.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const response = await openai.chat.completions.create(params);
  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls" || choice.message.tool_calls) {
    return {
      type: "function_call",
      calls: choice.message.tool_calls.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  return { type: "text", content: choice.message.content };
}

export async function embed(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
```

### [NEW] `ai-agent/core/providers/deepseekProvider.js`

```javascript
import OpenAI from "openai";
import config from "../../config.js";

// DeepSeek uses OpenAI-compatible API
const deepseek = new OpenAI({
  apiKey: config.deepseek.apiKey,
  baseURL: "https://api.deepseek.com",
});

export async function chat(messages, tools, systemPrompt) {
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const params = {
    model: "deepseek-chat",
    messages: formattedMessages,
  };

  if (tools && tools.length > 0) {
    params.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const response = await deepseek.chat.completions.create(params);
  const choice = response.choices[0];

  if (choice.message.tool_calls) {
    return {
      type: "function_call",
      calls: choice.message.tool_calls.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  return { type: "text", content: choice.message.content };
}

// DeepSeek doesn't have embeddings — fall back to Gemini
export { embed } from "./geminiProvider.js";
```

### [NEW] `ai-agent/core/providers/index.js`

```javascript
import config from "../../config.js";
import * as gemini from "./geminiProvider.js";
import * as openai from "./openaiProvider.js";
import * as deepseek from "./deepseekProvider.js";

const providers = { gemini, openai, deepseek };

export function getProvider(name) {
  const provider = providers[name || config.aiProvider];
  if (!provider) throw new Error(`Unknown AI provider: ${name || config.aiProvider}`);
  return provider;
}

export function chat(messages, tools, systemPrompt, providerName) {
  return getProvider(providerName).chat(messages, tools, systemPrompt);
}

export function embed(text, providerName) {
  return getProvider(providerName).embed(text);
}
```

---

## STEP 4: Tool Definitions

### [NEW] `ai-agent/core/tools.js`

These are the function-calling tool definitions the AI uses:

```javascript
export const toolDefinitions = [
  {
    name: "check_availability",
    description: "Check available turf slots for a specific date. Returns all turfs with their hourly availability and pricing.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        turf_id: { type: "string", description: "Optional specific turf ID to check" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_turf_list",
    description: "Get list of all turfs with their details, pricing, amenities, and operating hours.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_pricing",
    description: "Calculate price for a specific turf, date, and time range.",
    parameters: {
      type: "object",
      properties: {
        turf_id: { type: "string", description: "Turf ID" },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        start_hour: { type: "number", description: "Start hour (e.g., 17 for 5 PM)" },
        end_hour: { type: "number", description: "End hour (e.g., 19 for 7 PM)" },
      },
      required: ["turf_id", "date", "start_hour", "end_hour"],
    },
  },
  {
    name: "create_booking",
    description: "Create a new turf booking for a customer.",
    parameters: {
      type: "object",
      properties: {
        turf_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        start_hour: { type: "number" },
        end_hour: { type: "number" },
        customer_name: { type: "string" },
        customer_phone: { type: "string" },
        payment_method: { type: "string", enum: ["bkash", "nagad", "rocket", "cash", "card"] },
      },
      required: ["turf_id", "date", "start_hour", "end_hour", "customer_name", "customer_phone"],
    },
  },
  {
    name: "get_bookings_by_phone",
    description: "Look up all bookings for a customer by their phone number.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Customer phone number" },
        status: { type: "string", enum: ["confirmed", "cancelled", "all"] },
      },
      required: ["phone"],
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel a booking by its ID.",
    parameters: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
      },
      required: ["booking_id"],
    },
  },
  {
    name: "list_products",
    description: "List available products in the shop with prices and stock.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category: beverage, apparel, gear, equipment, medical" },
      },
    },
  },
  {
    name: "create_order",
    description: "Create a product order for a customer.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
        customer_name: { type: "string" },
        customer_phone: { type: "string" },
        payment_method: { type: "string", enum: ["bkash", "nagad", "rocket", "cash", "card"] },
      },
      required: ["items"],
    },
  },
  {
    name: "get_tournaments",
    description: "List tournaments (upcoming, ongoing, or completed).",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["upcoming", "ongoing", "completed", "all"] },
      },
    },
  },
  {
    name: "get_dashboard",
    description: "Get business dashboard: revenue, bookings, expenses, profit for a period.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_profit_loss",
    description: "Get detailed P&L report: revenue breakdown, COGS, expenses, net profit.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
  },
  {
    name: "get_receivables",
    description: "Get list of unpaid/partially paid bookings with outstanding amounts.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_knowledge",
    description: "Search the business knowledge base for policies, FAQ, turf details, or any business information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
];
```

### [NEW] `ai-agent/core/toolExecutor.js`

```javascript
import prisma from "../db/prismaClient.js";
// Import shared services from server
import { getAvailableSlots, calculatePrice, createBooking, cancelBooking } from "../../server/services/bookingService.js";
import { createOrder } from "../../server/services/orderService.js";
import { getProfitLoss, getCashPosition, getReceivables, getDashboard } from "../../server/services/reportingService.js";
import { searchKnowledge } from "../rag/retriever.js";

export async function executeTool(name, args) {
  switch (name) {
    case "check_availability": {
      if (args.turf_id) {
        const slots = await getAvailableSlots(args.turf_id, args.date);
        const turf = await prisma.turf.findUnique({ where: { id: args.turf_id } });
        return { turf: turf?.name, date: args.date, slots };
      }
      // All turfs
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
          id: true, name: true, type: true, size: true, location: true,
          description: true, base_price: true, peak_price: true, night_price: true,
          opening_hour: true, closing_hour: true, peak_hours_start: true,
          peak_hours_end: true, weekend_multiplier: true, amenities: true,
        },
      });
    }

    case "get_pricing":
      return { price: await calculatePrice(args.turf_id, args.date, args.start_hour, args.end_hour) };

    case "create_booking":
      return await createBooking(args, null);

    case "get_bookings_by_phone": {
      const where = { customer_phone: { contains: args.phone } };
      if (args.status && args.status !== "all") where.status = args.status;
      return await prisma.booking.findMany({ where, orderBy: { date: "desc" }, take: 10 });
    }

    case "cancel_booking":
      return await cancelBooking(args.booking_id, null);

    case "list_products": {
      const where = { status: "active" };
      if (args.category) where.category = args.category;
      return await prisma.product.findMany({
        where,
        select: { id: true, name: true, category: true, price: true, stock: true, unit: true, description: true },
      });
    }

    case "create_order":
      return await createOrder(args, null);

    case "get_tournaments": {
      const where = {};
      if (args.status && args.status !== "all") where.status = args.status;
      return await prisma.tournament.findMany({ where, orderBy: { created_at: "desc" } });
    }

    case "get_dashboard":
      return await getDashboard(args, { role: "admin" });

    case "get_profit_loss":
      return await getProfitLoss(args);

    case "get_receivables":
      return await getReceivables({});

    case "search_knowledge":
      return await searchKnowledge(args.query);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
```

---

## STEP 5: AI Brain (Orchestrator)

### [NEW] `ai-agent/core/brain.js`

```javascript
import { chat } from "./providers/index.js";
import { toolDefinitions } from "./tools.js";
import { executeTool } from "./toolExecutor.js";
import { getSystemPrompt } from "./prompts.js";
import prisma from "../db/prismaClient.js";

const MAX_TOOL_ROUNDS = 5; // prevent infinite loops

/**
 * Process a message through the AI brain.
 * @param {string} message - User's message
 * @param {string} phoneNumber - User's phone number
 * @param {string} channel - "whatsapp" | "telegram" | "web"
 * @param {string} [providerOverride] - Force a specific AI provider
 * @returns {string} AI response text
 */
export async function processMessage(message, phoneNumber, channel = "whatsapp", providerOverride) {
  const startTime = Date.now();

  // Load or create session
  let session = await prisma.whatsAppSession.findUnique({ where: { phone_number: phoneNumber } });
  if (!session) {
    session = await prisma.whatsAppSession.create({
      data: { phone_number: phoneNumber, state: "idle", context: JSON.stringify([]) },
    });
  }

  // Parse conversation history
  const history = JSON.parse(session.context || "[]").slice(-10); // keep last 10 messages
  history.push({ role: "user", content: message });

  const systemPrompt = await getSystemPrompt(phoneNumber);
  let messages = [...history];
  let finalResponse = "";
  let toolsUsed = [];

  // Agentic loop: LLM may call tools, then we feed results back
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await chat(messages, toolDefinitions, systemPrompt, providerOverride);

    if (result.type === "text") {
      finalResponse = result.content;
      break;
    }

    if (result.type === "function_call") {
      for (const call of result.calls) {
        toolsUsed.push(call.name);
        const toolResult = await executeTool(call.name, call.arguments);
        messages.push({
          role: "assistant",
          content: `[Called tool: ${call.name}(${JSON.stringify(call.arguments)})]`,
        });
        messages.push({
          role: "user",
          content: `[Tool result for ${call.name}]: ${JSON.stringify(toolResult)}`,
        });
      }
    }
  }

  // Update session
  history.push({ role: "assistant", content: finalResponse });
  await prisma.whatsAppSession.update({
    where: { phone_number: phoneNumber },
    data: {
      context: JSON.stringify(history.slice(-20)), // keep last 20
      last_active: new Date(),
      customer_name: session.customer_name, // preserve
    },
  });

  // Log interaction
  await prisma.agentLog.create({
    data: {
      phone_number: phoneNumber,
      channel,
      direction: "inbound",
      message,
      intent: toolsUsed[0] || "conversation",
      tools_used: JSON.stringify(toolsUsed),
      ai_response: finalResponse,
      latency_ms: Date.now() - startTime,
    },
  });

  return finalResponse;
}
```

### [NEW] `ai-agent/core/prompts.js`

```javascript
import prisma from "../db/prismaClient.js";
import config from "../config.js";

export async function getSystemPrompt(phoneNumber) {
  // Get business settings
  const settings = await prisma.appSetting.findMany();
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  // Get turf names for context
  const turfs = await prisma.turf.findMany({
    where: { status: "active" },
    select: { id: true, name: true, type: true },
  });
  const turfList = turfs.map((t) => `- ${t.name} (${t.type}, ID: ${t.id})`).join("\n");

  // Check if this is an admin
  const isAdmin = config.adminPhones.some((p) => phoneNumber.includes(p));

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  return `You are the AI CEO assistant for ${config.businessName}, a turf (sports ground) booking facility in Dhaka, Bangladesh.

TODAY'S DATE: ${today}
CURRENCY: ${config.currency} (Bangladeshi Taka)
PAYMENT METHODS: bKash, Nagad, Rocket, Cash, Card

AVAILABLE TURFS:
${turfList}

YOUR ROLE:
${isAdmin ? `
- This is an ADMIN user. You can provide business reports, insights, and manage operations.
- You can show revenue, expenses, profit/loss, receivables, and any business data.
- Give honest, actionable business advice based on data.
` : `
- This is a CUSTOMER. Be friendly, helpful, and sales-oriented.
- Help them check availability, book slots, order products, and answer questions.
- Always suggest available alternatives if their preferred slot is taken.
- Encourage bookings and upsell when appropriate.
`}

CONVERSATION RULES:
1. Be concise. Use emojis sparingly but effectively.
2. Format messages for WhatsApp (use *bold*, _italic_, line breaks).
3. If customer speaks Bangla, respond in Bangla.
4. Always confirm details before creating bookings or orders.
5. Never reveal system internals, database IDs, or API details to customers.
6. When showing prices, always use ${config.currency} symbol.
7. When showing times, use 12-hour format (e.g., "5:00 PM" not "17").
8. For dates, use friendly format (e.g., "Tomorrow (Sep 18, Thursday)").
9. Use the search_knowledge tool if the customer asks about policies, amenities, or general business questions.
10. If you don't know something, say so honestly. Don't make up information.

BOOKING FLOW:
1. Customer asks about availability → use check_availability tool
2. Customer confirms slot → confirm details (turf, date, time, name, phone)
3. After confirmation → use create_booking tool
4. Send payment instructions (bKash number, reference)

${isAdmin ? `
ADMIN TOOLS:
- get_dashboard: Overview with revenue, expenses, profit
- get_profit_loss: Detailed P&L breakdown
- get_receivables: Unpaid bookings
- You can compare periods, analyze trends, and give recommendations.
` : ""}`;
}
```

---

## STEP 6: WhatsApp — Dual Mode

### [NEW] `ai-agent/channels/whatsapp/unofficialClient.js`

Uses `whatsapp-web.js` for quick local prototyping:

```javascript
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { processMessage } from "../../core/brain.js";

let client = null;

export function initUnofficial() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: { headless: true, args: ["--no-sandbox"] },
  });

  client.on("qr", (qr) => {
    console.log("📱 Scan this QR code with WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Web client ready!");
  });

  client.on("message", async (msg) => {
    if (msg.from.endsWith("@g.us")) return; // ignore groups
    const phone = msg.from.replace("@c.us", "");
    console.log(`📩 [WhatsApp] ${phone}: ${msg.body}`);

    try {
      const reply = await processMessage(msg.body, phone, "whatsapp");
      await msg.reply(reply);
    } catch (err) {
      console.error("Error processing message:", err);
      await msg.reply("Sorry, something went wrong. Please try again.");
    }
  });

  client.initialize();
  return client;
}

export async function sendMessage(phone, text) {
  if (!client) throw new Error("WhatsApp client not initialized");
  const chatId = phone.includes("@c.us") ? phone : `${phone}@c.us`;
  await client.sendMessage(chatId, text);
}
```

### [NEW] `ai-agent/channels/whatsapp/officialClient.js`

Uses Meta Cloud API for production:

```javascript
import config from "../../config.js";
import { processMessage } from "../../core/brain.js";

const { accessToken, phoneNumberId } = config.whatsapp.official;
const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Send a text message via Meta Cloud API
 */
export async function sendMessage(phone, text) {
  const url = `${GRAPH_API}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("WhatsApp API error:", err);
    throw new Error(`WhatsApp send failed: ${JSON.stringify(err)}`);
  }
  return await response.json();
}

/**
 * Handle incoming webhook from Meta
 */
export async function handleWebhook(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return; // status update, not a message

  for (const message of value.messages) {
    if (message.type !== "text") continue; // skip media for now
    const phone = message.from;
    const text = message.text.body;

    console.log(`📩 [WhatsApp Official] ${phone}: ${text}`);

    try {
      const reply = await processMessage(text, phone, "whatsapp");
      await sendMessage(phone, reply);
    } catch (err) {
      console.error("Error processing message:", err);
      await sendMessage(phone, "Sorry, something went wrong. Please try again.");
    }
  }
}

/**
 * Express routes for webhook
 */
export function setupWebhookRoutes(app) {
  // Verification challenge
  app.get("/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === config.whatsapp.official.verifyToken) {
      console.log("✅ WhatsApp webhook verified");
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  });

  // Incoming messages
  app.post("/webhook/whatsapp", async (req, res) => {
    res.sendStatus(200); // acknowledge immediately
    try {
      await handleWebhook(req.body);
    } catch (err) {
      console.error("Webhook error:", err);
    }
  });
}
```

### [NEW] `ai-agent/channels/whatsapp/index.js`

Toggle between official and unofficial:

```javascript
import config from "../../config.js";

let sendMessageFn = null;

export async function initWhatsApp(app) {
  if (config.whatsappMode === "official") {
    const { setupWebhookRoutes, sendMessage } = await import("./officialClient.js");
    setupWebhookRoutes(app);
    sendMessageFn = sendMessage;
    console.log("📱 WhatsApp: Official (Meta Cloud API) mode");
  } else {
    const { initUnofficial, sendMessage } = await import("./unofficialClient.js");
    initUnofficial();
    sendMessageFn = sendMessage;
    console.log("📱 WhatsApp: Unofficial (whatsapp-web.js) mode");
  }
}

export async function sendWhatsAppMessage(phone, text) {
  if (!sendMessageFn) throw new Error("WhatsApp not initialized");
  return sendMessageFn(phone, text);
}
```

---

## STEP 7: Telegram Admin Bot

### [NEW] `ai-agent/channels/telegram/adminBot.js`

```javascript
import { Telegraf } from "telegraf";
import config from "../../config.js";
import { processMessage } from "../../core/brain.js";

let bot = null;

export function initTelegram() {
  if (!config.telegram.botToken) {
    console.log("⚠️ Telegram: No bot token, skipping");
    return;
  }

  bot = new Telegraf(config.telegram.botToken);

  bot.start((ctx) => ctx.reply("🤖 TurfSlot AI CEO Agent ready!\n\nAsk me anything about the business."));

  bot.on("text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const isAdmin = config.telegramAdminChatIds.includes(chatId) || config.telegramAdminChatIds.length === 0;

    if (!isAdmin) {
      return ctx.reply("⛔ Unauthorized. Contact admin to get access.");
    }

    try {
      const reply = await processMessage(ctx.message.text, `tg_${chatId}`, "telegram");
      await ctx.reply(reply, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("Telegram error:", err);
      await ctx.reply("Error processing your request.");
    }
  });

  bot.launch();
  console.log("🤖 Telegram admin bot launched");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

/**
 * Send a notification to all admin chat IDs
 */
export async function notifyAdmins(message) {
  if (!bot) return;
  for (const chatId of config.telegramAdminChatIds) {
    try {
      await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (err) {
      console.error(`Failed to notify admin ${chatId}:`, err.message);
    }
  }
}
```

---

## STEP 8: RAG Knowledge Base

### [NEW] `ai-agent/rag/vectorStore.js`

Simple in-memory vector store using cosine similarity:

```javascript
import { embed } from "../core/providers/index.js";

const documents = []; // { id, text, embedding, metadata }

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function addDocument(id, text, metadata = {}) {
  const embedding = await embed(text);
  const existing = documents.findIndex((d) => d.id === id);
  if (existing >= 0) {
    documents[existing] = { id, text, embedding, metadata };
  } else {
    documents.push({ id, text, embedding, metadata });
  }
}

export async function search(query, topK = 5) {
  const queryEmbedding = await embed(query);
  const scored = documents.map((doc) => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((d) => d.score > 0.3); // threshold
}

export function getDocumentCount() {
  return documents.length;
}
```

### [NEW] `ai-agent/rag/indexer.js`

```javascript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db/prismaClient.js";
import { addDocument } from "./vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../knowledge");

export async function indexAll() {
  console.log("📚 Indexing knowledge base...");

  // 1. Index markdown files from knowledge/ directory
  if (fs.existsSync(KNOWLEDGE_DIR)) {
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
      // Split into sections by ## headers
      const sections = content.split(/^## /m).filter(Boolean);
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (section.length > 50) {
          await addDocument(`kb_${file}_${i}`, section, { source: file });
        }
      }
    }
    console.log(`  ✅ Indexed ${files.length} knowledge files`);
  }

  // 2. Index turfs from database
  const turfs = await prisma.turf.findMany({ where: { status: "active" } });
  for (const turf of turfs) {
    const text = `Turf: ${turf.name}. Type: ${turf.type}. Size: ${turf.size || "N/A"}. Location: ${turf.location || "N/A"}. ${turf.description || ""}. Amenities: ${JSON.stringify(turf.amenities || [])}. Base price: ${turf.base_price} taka/hour. Peak price: ${turf.peak_price} taka/hour (${turf.peak_hours_start}-${turf.peak_hours_end}). Night price: ${turf.night_price}. Weekend multiplier: ${turf.weekend_multiplier}x. Hours: ${turf.opening_hour}:00 to ${turf.closing_hour}:00.`;
    await addDocument(`turf_${turf.id}`, text, { type: "turf", id: turf.id });
  }
  console.log(`  ✅ Indexed ${turfs.length} turfs`);

  // 3. Index products
  const products = await prisma.product.findMany({ where: { status: "active" } });
  for (const p of products) {
    const text = `Product: ${p.name}. Category: ${p.category}. Price: ${p.price} taka. Stock: ${p.stock} ${p.unit}. ${p.description || ""}`;
    await addDocument(`product_${p.id}`, text, { type: "product", id: p.id });
  }
  console.log(`  ✅ Indexed ${products.length} products`);

  // 4. Index active tournaments
  const tournaments = await prisma.tournament.findMany({ where: { status: { in: ["upcoming", "ongoing"] } } });
  for (const t of tournaments) {
    const teams = t.teams || [];
    const text = `Tournament: ${t.name}. Turf: ${t.turf_name}. Dates: ${t.start_date} to ${t.end_date}. Format: ${t.format}. Entry fee: ${t.entry_fee} taka. Prize pool: ${t.prize_pool} taka. Max teams: ${t.max_teams}. Registered teams: ${teams.length}. Available slots: ${t.max_teams - teams.length}. Status: ${t.status}. ${t.description || ""}`;
    await addDocument(`tournament_${t.id}`, text, { type: "tournament", id: t.id });
  }
  console.log(`  ✅ Indexed ${tournaments.length} tournaments`);

  console.log("📚 Knowledge base indexing complete!");
}
```

### [NEW] `ai-agent/rag/retriever.js`

```javascript
import { search } from "./vectorStore.js";

export async function searchKnowledge(query) {
  const results = await search(query, 5);
  return results.map((r) => ({
    text: r.text,
    source: r.metadata.source || r.metadata.type || "unknown",
    relevance: Math.round(r.score * 100) + "%",
  }));
}
```

### [NEW] `ai-agent/knowledge/business-rules.md`

```markdown
## Operating Hours
All turfs operate from 6:00 AM to 11:00 PM (23:00) daily, including weekends and holidays.

## Pricing Structure
- **Base Price**: Standard rate for off-peak hours (morning and afternoon)
- **Peak Price**: Higher rate during peak hours (typically 5 PM to 10 PM)
- **Night Price**: Special rate for late evening slots (9 PM onwards)
- **Weekend Multiplier**: Prices are 10-20% higher on Fridays and Saturdays

## Payment Methods
We accept: bKash, Nagad, Rocket, Cash, and Card payments.
bKash is the most popular payment method.

## Booking Policy
- Bookings can be made up to 30 days in advance
- Minimum booking duration is 1 hour
- Cancellations must be made at least 2 hours before the slot
- Full refund for cancellations made 24+ hours in advance
- 50% refund for cancellations made 2-24 hours in advance
- No refund for cancellations less than 2 hours before

## Rain Policy
- Games proceed under light rain on covered turfs
- Full refund or reschedule for heavy rain cancellations (facility decision)

## Group Discounts
- Block booking (4+ hours): 10% discount
- Regular customers (10+ bookings): VIP pricing available
- Corporate packages available on request
```

### [NEW] `ai-agent/knowledge/faq.md`

```markdown
## Do you have parking?
Yes, all our turf locations have dedicated parking facilities.

## Can we bring our own football?
Yes, you can bring your own ball. We also have match balls available for rent.

## Is there a changing room?
Yes, all turfs have changing rooms. Thunder Arena and Premier Turf Ground also have shower facilities.

## Do you have floodlights for night games?
Yes, all turfs have professional floodlight systems for evening and night games.

## Can we get drinking water?
Yes, we sell Kinley Mineral Water (25 taka) and various sports drinks at our shop.

## Do you have jerseys/bibs for teams?
Yes, we have sports bibs available for purchase (250 taka) or you can rent them.

## Is the turf suitable for cricket practice?
Premier Turf Ground is suitable for cricket practice sessions.

## How do I organize a tournament?
Contact us to discuss tournament packages. We handle scheduling, referee, and prize distribution.

## What if I arrive late?
Your booking is valid for the reserved time slot. We cannot extend the slot if you arrive late.

## Can I book multiple consecutive hours?
Yes, you can book 1, 1.5, or 2 hour slots. For longer durations, ask about our block booking discount.
```

---

## STEP 9: Automation

### [NEW] `ai-agent/automation/scheduler.js`

```javascript
import cron from "node-cron";
import { generateDailyBriefing } from "../admin/dailyBriefing.js";
import { checkLowStock } from "./inventoryMonitor.js";
import { sendBookingReminders, autoCancelUnpaid } from "./bookingLifecycle.js";
import { indexAll } from "../rag/indexer.js";

export function startScheduler() {
  // Daily briefing at 8 AM Bangladesh time (2 AM UTC)
  cron.schedule("0 2 * * *", async () => {
    console.log("⏰ Running daily briefing...");
    await generateDailyBriefing();
  });

  // Check for low stock every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    await checkLowStock();
  });

  // Booking reminders every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    await sendBookingReminders();
  });

  // Auto-cancel unpaid bookings every hour
  cron.schedule("0 * * * *", async () => {
    await autoCancelUnpaid();
  });

  // Re-index RAG knowledge base daily at 3 AM
  cron.schedule("0 21 * * *", async () => {
    await indexAll();
  });

  console.log("⏰ Scheduler started");
}
```

### [NEW] `ai-agent/automation/bookingLifecycle.js`

```javascript
import prisma from "../db/prismaClient.js";
import { sendWhatsAppMessage } from "../channels/whatsapp/index.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";

export async function sendBookingReminders() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getUTCHours() + 6; // Bangladesh is UTC+6

  // Find bookings starting in ~2 hours
  const targetHour = currentHour + 2;
  const bookings = await prisma.booking.findMany({
    where: {
      date: today,
      start_hour: { gte: targetHour, lt: targetHour + 0.5 },
      status: "confirmed",
    },
  });

  for (const booking of bookings) {
    const timeStr = formatHour(booking.start_hour);
    const msg = `⏰ Reminder: Your booking at *${booking.turf_name}* starts at *${timeStr}* today!\n\n🏟 ${booking.turf_name}\n⏰ ${timeStr} - ${formatHour(booking.end_hour)}\n\nSee you there! 🎯`;
    try {
      await sendWhatsAppMessage(booking.customer_phone, msg);
    } catch (err) {
      console.error(`Reminder failed for ${booking.customer_phone}:`, err.message);
    }
  }
}

export async function autoCancelUnpaid() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const unpaid = await prisma.booking.findMany({
    where: {
      payment_status: "unpaid",
      status: "confirmed",
      created_at: { lt: sixHoursAgo },
    },
  });

  for (const booking of unpaid) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", notes: "Auto-cancelled: unpaid after 6 hours" },
    });

    try {
      await sendWhatsAppMessage(
        booking.customer_phone,
        `❌ Your booking at *${booking.turf_name}* on ${booking.date} has been automatically cancelled due to non-payment.\n\nBook again anytime!`
      );
    } catch (err) { /* ignore */ }

    await notifyAdmins(`🔴 Auto-cancelled unpaid booking: ${booking.customer_name} at ${booking.turf_name} (${booking.date})`);
  }
}

function formatHour(h) {
  const hour = Math.floor(h);
  const min = h % 1 === 0.5 ? "30" : "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${min} ${ampm}`;
}
```

### [NEW] `ai-agent/automation/inventoryMonitor.js`

```javascript
import prisma from "../db/prismaClient.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";

export async function checkLowStock() {
  const products = await prisma.product.findMany({ where: { status: "active" } });
  const lowStock = products.filter((p) => p.stock <= p.low_stock_alert);

  if (lowStock.length === 0) return;

  let msg = "📦 *Low Stock Alert*\n\n";
  for (const p of lowStock) {
    const emoji = p.stock === 0 ? "🔴" : "🟡";
    msg += `${emoji} ${p.name}: *${p.stock}* ${p.unit} left\n`;
  }

  await notifyAdmins(msg);
}
```

---

## STEP 10: Admin Intelligence

### [NEW] `ai-agent/admin/dailyBriefing.js`

```javascript
import { getDashboard, getProfitLoss } from "../../server/services/reportingService.js";
import prisma from "../db/prismaClient.js";
import { notifyAdmins } from "../channels/telegram/adminBot.js";
import { sendWhatsAppMessage } from "../channels/whatsapp/index.js";
import config from "../config.js";

export async function generateDailyBriefing() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Yesterday's stats
  const yesterdayDash = await getDashboard({ from: yesterday, to: yesterday }, { role: "admin" });
  const todayBookings = await prisma.booking.findMany({
    where: { date: today, status: "confirmed" },
  });
  const unpaid = await prisma.booking.findMany({
    where: { payment_status: "unpaid", status: "confirmed" },
  });
  const lowStock = await prisma.product.findMany({
    where: { status: "active", stock: { lte: 5 } },
  });

  const unpaidTotal = unpaid.reduce((s, b) => s + b.total_price - b.paid_amount, 0);

  let msg = `🌅 *Good Morning!*\n\n`;
  msg += `📊 *Yesterday (${yesterday})*\n`;
  msg += `💰 Revenue: ${config.currency}${(yesterdayDash.total_revenue / 100).toLocaleString()}\n`;
  msg += `📉 Expenses: ${config.currency}${(yesterdayDash.total_expenses / 100).toLocaleString()}\n`;
  msg += `📈 Net Profit: ${config.currency}${(yesterdayDash.net_profit / 100).toLocaleString()}\n`;
  msg += `🏟 Bookings: ${yesterdayDash.booking_count || 0}\n`;
  msg += `🛒 Orders: ${yesterdayDash.order_count || 0}\n\n`;

  msg += `🔮 *Today (${today})*\n`;
  msg += `📋 ${todayBookings.length} bookings confirmed\n`;

  if (unpaid.length > 0) {
    msg += `⚠️ ${unpaid.length} unpaid bookings (${config.currency}${unpaidTotal.toLocaleString()})\n`;
  }

  if (lowStock.length > 0) {
    msg += `\n📦 *Stock Alerts*\n`;
    for (const p of lowStock) {
      msg += `${p.stock === 0 ? "🔴" : "🟡"} ${p.name}: ${p.stock} left\n`;
    }
  }

  // Send via Telegram
  await notifyAdmins(msg);

  // Also send via WhatsApp to admin phones
  for (const phone of config.adminPhones) {
    try {
      await sendWhatsAppMessage(phone, msg);
    } catch (err) { /* ignore */ }
  }
}
```

---

## STEP 11: Main Entry Point

### [NEW] `ai-agent/index.js`

```javascript
import "dotenv/config";
import express from "express";
import config from "./config.js";
import { initWhatsApp } from "./channels/whatsapp/index.js";
import { initTelegram } from "./channels/telegram/adminBot.js";
import { indexAll } from "./rag/indexer.js";
import { startScheduler } from "./automation/scheduler.js";
import { processMessage } from "./core/brain.js";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "turfslot-ai-agent", uptime: process.uptime() });
});

// Manual query endpoint (for admin dashboard or testing)
app.post("/api/agent/query", async (req, res) => {
  const { message, phone, channel } = req.body;
  try {
    const reply = await processMessage(message, phone || "api_user", channel || "web");
    res.json({ success: true, response: reply });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Startup sequence
async function start() {
  console.log("🚀 TurfSlot AI CEO Agent starting...");

  // 1. Index knowledge base
  await indexAll();

  // 2. Initialize WhatsApp (official or unofficial based on env)
  await initWhatsApp(app);

  // 3. Initialize Telegram admin bot
  initTelegram();

  // 4. Start automation scheduler
  startScheduler();

  // 5. Start HTTP server
  app.listen(config.port, () => {
    console.log(`🤖 AI Agent running on port ${config.port}`);
    console.log(`   Mode: ${config.whatsappMode} WhatsApp | ${config.aiProvider} AI`);
  });
}

start().catch(console.error);
```

---

## STEP 12: Build & Run

```bash
cd ai-agent/

# Install dependencies
npm install

# Generate Prisma client (uses same schema)
npx prisma generate

# Push new tables to database
npx prisma db push

# Run in development
npm run dev

# For production (PM2)
pm2 start index.js --name turfslot-ai-agent
```

---

## Build Order Checklist

1. [ ] Extract shared services (bookingService.js, orderService.js)
2. [ ] Set up ai-agent/ project (package.json, .env, prisma)
3. [ ] Build multi-provider AI brain (Gemini/OpenAI/DeepSeek)
4. [ ] Implement all tools + tool executor
5. [ ] Build WhatsApp unofficial client (quick test)
6. [ ] Build WhatsApp official client (production)
7. [ ] Build Telegram admin bot
8. [ ] Build RAG knowledge base + indexer
9. [ ] Build booking lifecycle automation
10. [ ] Build inventory monitoring
11. [ ] Build daily briefing
12. [ ] Build scheduler
13. [ ] Test end-to-end with real WhatsApp
14. [ ] Deploy with PM2 on VPS
