# TurfSlot AI CEO Agent — Complete Vision & Architecture

## Architecture Decision: Separate Repo / Service ✅

> [!IMPORTANT]
> **Recommendation: Separate `ai-agent/` service, same MySQL database.**

### Why Separate?

| Concern | Same Repo Problem | Separate Service Benefit |
|---|---|---|
| **Crash isolation** | AI agent crash takes down booking API | API stays up even if agent restarts |
| **Scaling** | AI calls are slow (2-5s LLM calls) — blocks Express event loop | Agent runs its own event loop, can scale independently |
| **Dependencies** | AI libs (`@google/generative-ai`, vector DB, `node-cron`) bloat your lean API | Each service has minimal deps |
| **Deployment** | Can't deploy AI updates without restarting booking API | Independent deploys |
| **Cost** | AI service needs different server specs (more RAM, less CPU) | Right-size each service |

### How They Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                     TurfSlot Monorepo                           │
│                                                                 │
│  ┌──────────────┐     ┌──────────────────────────────────────┐  │
│  │  server/      │     │  ai-agent/                           │  │
│  │  (Express API)│     │  (AI CEO Service)                    │  │
│  │              │     │                                      │  │
│  │  REST API    │     │  • WhatsApp Gateway (webhook)        │  │
│  │  Auth        │     │  • AI Brain (Gemini + function call)  │  │
│  │  Uploads     │     │  • RAG Engine (knowledge base)       │  │
│  │  License     │     │  • Admin Intelligence                │  │
│  │              │     │  • Cron Scheduler                    │  │
│  │  Port 5000   │     │  • Automation Pipelines              │  │
│  │              │     │                                      │  │
│  │              │     │  Port 5001                           │  │
│  └──────┬───────┘     └─────────────┬────────────────────────┘  │
│         │                           │                           │
│         └───────────┬───────────────┘                           │
│                     │                                           │
│              ┌──────▼──────┐                                    │
│              │  Shared      │                                    │
│              │  prisma/     │  (symlinked or shared schema)     │
│              │  schema.prisma                                   │
│              │              │                                    │
│              └──────┬──────┘                                    │
│                     │                                           │
│              ┌──────▼──────┐                                    │
│              │  MySQL DB    │                                    │
│              │  (existing)  │                                    │
│              └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key**: Both services use the **same Prisma client** pointing at the **same MySQL database**. The AI agent reads/writes directly — no HTTP round-trips to the API server. They're siblings, not client-server.

---

## Everything the AI CEO Agent Can Do

### 🟢 Module 1: RAG Knowledge Base (Conversational AI)

A **Retrieval-Augmented Generation** system that knows everything about your business:

#### What Gets Indexed (Knowledge Sources)

| Source | Content | Update Frequency |
|---|---|---|
| **Business Rules** | Pricing logic (base/peak/night/weekend), operating hours, payment methods, refund policy, booking rules | Manual (you edit a markdown file) |
| **Turf Profiles** | Name, type, size, location, amenities, pricing config, description | Auto-sync from DB on change |
| **Product Catalog** | Names, prices, stock levels, categories, descriptions | Auto-sync from DB on change |
| **Tournament Info** | Current/upcoming tournaments, rules, entry fees, team slots | Auto-sync from DB |
| **FAQ & Policies** | Cancellation policy, rain policy, group discounts, membership info, how to reach us | Manual markdown file |
| **Historical Patterns** | "We're usually fully booked on Friday evenings", "Monsoon season is slower" | AI-generated from data analysis |
| **Staff SOPs** | How to handle complaints, how to process refunds, emergency procedures | Manual markdown file |

#### How RAG Works

```
Customer: "Do you have covered turfs? It might rain tomorrow"

1. Embed the question → vector
2. Search knowledge base → finds:
   - Premier Turf Ground has "Covered Pavilion" amenity
   - Thunder Arena is outdoor
   - Rain policy: "Games proceed under light rain. Full refund for heavy rain cancellations."
3. Feed context + question to Gemini
4. Response: "Great news! Our Premier Turf Ground in Dhanmondi has a covered
   pavilion — perfect for rainy days! It's a 6-a-side turf at ৳2,200/hr.
   
   Also, if it rains heavily and we need to cancel, you'll get a full refund.
   Want me to check availability for tomorrow?"
```

#### RAG Implementation

| File | Purpose |
|---|---|
| `ai-agent/rag/vectorStore.js` | In-memory vector store using embeddings (no external DB needed) |
| `ai-agent/rag/indexer.js` | Index documents from DB + markdown files into vectors |
| `ai-agent/rag/retriever.js` | Semantic search — find relevant docs for a query |
| `ai-agent/knowledge/` | Markdown files: `business-rules.md`, `faq.md`, `policies.md`, `sops.md` |

**Vector Store Options**: Start with in-memory (`hnswlib-node` or simple cosine similarity). Scale to ChromaDB or Pinecone later if needed.

---

### 🟢 Module 2: WhatsApp Customer Bot

- **Availability checks**: Instantly check available time slots across all turfs for any date.
- **Bookings**: Collect customer name, turf preference, slot time, and reserve slots.
- **Shop Orders**: List energy drinks, shin guards, balls, bibs, and take item orders directly in chat.
- **Pricing & Discounts**: Calculate base, peak, weekend rates and apply applicable promo rates.
- **Business Q&A with RAG**: Answer questions on parking, rain cancellation, rules, and amenities.
- **Bangla & English Support**: Naturally responds in both conversational Bangla and English.
- **Voice Messages (Optional)**: Voice note transcription via Whisper API.

---

### 🟢 Module 3: Admin Intelligence

- **Daily Morning Briefings**: Automated 8:00 AM summary of yesterday's revenue, expenses, net profit, upcoming bookings, and stock alerts.
- **Real-time Alerts**: High-priority notifications for new bookings, cancellations, or critically low inventory.
- **On-Demand Queries**: Natural language questions like *"How much did we make this week?"*, *"Who owes us money?"*, or *"Show me Thunder Arena occupancy rate."*
- **Actionable Insights**: AI recommendations based on occupancy trends and customer churn.

---

### 🟢 Module 4: Automation & AI Orchestration

#### 4.1 Smart Pricing Engine
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Demand Data │ ──▶ │ Pricing AI   │ ──▶ │ Price Update │
│ (bookings,  │     │ (rules +     │     │ (auto or     │
│  time, day) │     │  ML predict) │     │  suggest)    │
└─────────────┘     └──────────────┘     └─────────────┘
```
- **Dynamic pricing**: If a slot is 80% booked 2 days ahead → auto-increase price by 15%
- **Discount engine**: If morning slots are empty → suggest 20% discount to admin
- **Competitor awareness**: Manual input of competitor prices → AI suggests competitive rates
- **Seasonal patterns**: Monsoon discounts, Eid holiday premium pricing

#### 4.2 Automated Booking Lifecycle
| Trigger | Action |
|---|---|
| Booking created (unpaid) | Send bKash payment link via WhatsApp after 5 min |
| Unpaid after 2 hours | Reminder: "Your slot is reserved but unpaid. Pay within 4 hours or it'll be released" |
| Unpaid after 6 hours | Auto-cancel + notify: "Your booking was released. Rebook anytime!" |
| 2 hours before slot | Reminder: "Your game at Thunder Arena starts in 2 hours! 🏟" |
| 30 min after slot ends | Follow-up: "Thanks for playing! Book again? Here's 10% off your next slot" |
| 5th booking by same customer | Loyalty reward: "You're a VIP! Your next booking gets 15% off" |

#### 4.3 Payment Reconciliation Bot
- Customer sends bKash TXN ID → AI verifies format, matches amount, auto-marks as paid
- Daily reconciliation: Compare `payments` table vs `journal_lines` → flag mismatches
- Alert admin: "3 bookings from today are still unpaid (total ৳8,400)"

#### 4.4 Inventory Auto-Management
| Trigger | Action |
|---|---|
| Stock drops below `low_stock_alert` | WhatsApp admin: "⚠️ Water bottles: 3 left. Reorder?" |
| Stock reaches 0 | Auto-hide from customer catalog, notify admin |
| Admin replies "order 100 water" | AI creates purchase order note |
| Weekly | Stock report: consumption rate, days until stockout, reorder suggestions |

#### 4.5 Customer CRM & Segmentation
```prisma
model CustomerProfile {
  id              String   @id @default(uuid())
  phone_number    String   @unique
  name            String?
  total_bookings  Int      @default(0)
  total_spent     Float    @default(0)
  avg_booking     Float    @default(0)
  preferred_turf  String?
  preferred_time  String?  // "evening", "morning", "night"
  preferred_day   String?  // "weekend", "weekday"
  segment         String   @default("new")  // new, regular, vip, churned
  last_visit      String?
  created_at      DateTime @default(now())
  @@map("customer_profiles")
}
```
- **Auto-segment** customers: New → Regular (3+ bookings) → VIP (10+ bookings) → Churned (no booking in 30 days)
- **Win-back campaigns**: "We miss you, Rahim! Book this week and get 20% off"
- **Birthday/occasion** messages (if collected)
- **Referral tracking**: "Invite a friend, both get ৳200 off"

#### 4.6 Staff & Operations Automation
| Feature | What It Does |
|---|---|
| **Shift reminders** | WhatsApp staff: "Your shift starts at 5 PM today" |
| **Daily task list** | "Today: 8 bookings confirmed, restock water, tournament prep for Saturday" |
| **Incident logging** | Staff reports issues via WhatsApp: "Light #3 broken" → creates maintenance ticket |
| **Handover notes** | End-of-shift auto-summary for next staff |

#### 4.7 Marketing Automation
| Feature | What It Does |
|---|---|
| **Empty slot broadcast** | 4 PM: "Tonight's 8-9 PM slot at Thunder Arena is open! Book now for ৳2,800 instead of ৳3,500" |
| **Tournament promotion** | Auto-send to past customers: "Monsoon Super League starts next week! 4 team slots left" |
| **Weekend preview** | Thursday evening: "This weekend's availability" to regular customers |
| **Review collection** | Post-match: "Rate your experience 1-5 ⭐" → aggregate for insights |

#### 4.8 Financial Intelligence
| Feature | What It Does |
|---|---|
| **Revenue forecasting** | "Based on current bookings, this month's projected revenue is ৳4,50,000 (+12% vs last month)" |
| **Expense anomaly detection** | "Utilities bill is 30% higher than average. Check for issues?" |
| **Cash flow prediction** | "You'll need ৳1,33,000 for rent + salaries on the 5th. Current cash: ৳2,10,000 ✅" |
| **Partner auto-reports** | Monthly P&L + profit share calculation sent to partners automatically |
| **Tax preparation** | Quarterly revenue/expense summary in tax-ready format |

#### 4.9 Competitive Intelligence Dashboard
| Feature | What It Does |
|---|---|
| **Market rate tracking** | Input competitor prices → AI shows where you stand |
| **Occupancy benchmarking** | "Your weekday utilization is 45%. Industry average is 55%. Here's how to improve" |
| **Social listening** | (Future) Monitor Facebook/Google reviews for sentiment |

#### 4.10 Multi-Channel Orchestration
```
                    ┌──────────┐
                    │ WhatsApp │ ◀── Customers
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ AI Brain │ ──── Single brain, multiple channels
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Telegram │   │ Facebook │   │ Web Chat │
    │ (Admin)  │   │ Messenger│   │ (Widget) │
    └──────────┘   └──────────┘   └──────────┘
```
- Same AI brain powers all channels
- Telegram for admin (interactive bot)
- Facebook Messenger for customers (future)
- Embeddable web chat widget for your website (future)

---

## Proposed `ai-agent/` Service Structure

```
ai-agent/
├── package.json
├── .env
├── index.js                    # Service entry point
├── prisma/                     # Shared schema with server/prisma
│   └── schema.prisma
│
├── core/
│   ├── brain.js                # Main AI orchestrator (Gemini + function calling)
│   ├── tools.js                # All tool definitions for function calling
│   ├── toolExecutor.js         # Execute tools against DB
│   └── conversationManager.js  # Session state, history, context window
│
├── rag/
│   ├── vectorStore.js          # Embedding storage + similarity search
│   ├── indexer.js              # Index DB data + markdown into vectors
│   ├── retriever.js            # Semantic retrieval for queries
│   └── syncJob.js              # Periodic re-index from DB changes
│
├── channels/
│   ├── whatsapp/
│   │   ├── gateway.js          # Meta Cloud API send/receive
│   │   ├── webhook.js          # Express webhook routes
│   │   └── templates.js        # Message templates (booking confirm, reminder)
│   ├── telegram/
│   │   └── adminBot.js         # Admin Telegram notifications
│   └── web/
│       └── chatWidget.js       # Future: embeddable web chat API
│
├── automation/
│   ├── scheduler.js            # Cron job orchestrator
│   ├── bookingLifecycle.js     # Auto-reminders, auto-cancel unpaid
│   ├── pricingEngine.js        # Dynamic pricing suggestions
│   ├── inventoryMonitor.js     # Stock alerts, reorder suggestions
│   ├── paymentReconciler.js    # Auto-verify payments, flag mismatches
│   ├── customerCRM.js          # Segmentation, loyalty, win-back
│   └── marketingEngine.js      # Broadcasts, promotions, follow-ups
│
├── admin/
│   ├── dailyBriefing.js        # Morning summary generator
│   ├── alertEngine.js          # Real-time event alerts
│   ├── insightsEngine.js       # Business intelligence + recommendations
│   └── reportGenerator.js      # On-demand report builder
│
├── knowledge/                  # RAG source documents (you edit these)
│   ├── business-rules.md       # Pricing, hours, payment methods
│   ├── faq.md                  # Common customer questions
│   ├── policies.md             # Cancellation, refund, rain policy
│   └── sops.md                 # Staff procedures
│
└── utils/
    ├── logger.js               # Structured logging
    ├── rateLimiter.js          # WhatsApp API rate limiting
    └── formatter.js            # Currency, date, phone formatting
```

---

## New Schema Additions (in shared `prisma/schema.prisma`)

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
  id          String   @id @default(uuid())
  name        String
  trigger     String
  action      String   @db.Text
  enabled     Int      @default(1)
  last_run    DateTime?
  run_count   Int      @default(0)
  created_at  DateTime @default(now())
  @@map("automation_rules")
}
```

---

## Environment Variables

```env
# AI Provider
GEMINI_API_KEY=your_key_here

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=custom_verify_string
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Telegram (admin alerts — reuse your existing bot)
TELEGRAM_BOT_TOKEN=your_existing_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id

# Agent Config
AGENT_PORT=5001
AGENT_ADMIN_PHONES=8801XXXXXXXXX
AGENT_LANGUAGE=bn,en
AGENT_LOG_LEVEL=info
```

---

## Build Order (Recommended Phases)

### Phase 1 (Week 1-2): Foundation
- [ ] Set up `ai-agent/` service with Prisma connection
- [ ] Build AI Brain with Gemini function calling
- [ ] Implement core tools (check availability, get pricing, list products)
- [ ] Basic WhatsApp webhook + message handling
- [ ] Customer can check slots and book via WhatsApp

### Phase 2 (Week 2-3): RAG + Admin
- [ ] RAG knowledge base with business rules + FAQ
- [ ] Daily briefing via Telegram (you already have the bot)
- [ ] Real-time alerts (new booking, cancellation, low stock)
- [ ] Admin can ask questions via Telegram

### Phase 3 (Week 3-4): Automation
- [ ] Booking lifecycle (reminders, auto-cancel unpaid)
- [ ] Payment verification
- [ ] Customer CRM + segmentation
- [ ] Inventory monitoring

### Phase 4 (Week 4+): Intelligence
- [ ] Smart pricing suggestions
- [ ] Marketing automation (empty slot broadcasts)
- [ ] Financial forecasting
- [ ] Revenue/expense insights

---

## Questions for You

> [!IMPORTANT]
> 1. **WhatsApp API**: Meta Cloud API (official, needs Facebook Business verification ~2-5 days) or `whatsapp-web.js` (unofficial, instant setup, risk of ban)?
> 2. **AI Provider**: Google Gemini (free tier: 15 RPM, 1M tokens/day) or OpenAI GPT-4o?
> 3. **Admin Channel**: Telegram (reuse your existing bot), WhatsApp (same number), or both?
> 4. **Build Order**: Start with Phase 1 (WhatsApp bot) or Phase 2 (admin intelligence) first?
> 5. **Separate repo or monorepo subfolder?**: I recommend `ai-agent/` folder inside TurfSlot monorepo (shared Prisma, easier to manage). Or completely separate git repo?
> 6. **Hosting**: Same VPS as your current API, or separate server?
