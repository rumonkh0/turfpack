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
        turf_id: { type: "string", description: "Turf ID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        start_hour: { type: "number", description: "Start hour (e.g. 18 for 6 PM)" },
        end_hour: { type: "number", description: "End hour (e.g. 19 for 7 PM)" },
        customer_name: { type: "string", description: "Customer name" },
        customer_phone: { type: "string", description: "Customer phone number" },
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
        booking_id: { type: "string", description: "Booking ID to cancel" },
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
        category: { type: "string", description: "Optional filter by category: beverage, apparel, gear, equipment, medical" },
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
            required: ["product_id", "quantity"],
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
  {
    name: "verify_customer_payment",
    description: "Verify and reconcile a customer payment using a transaction ID (bKash/Nagad TrxID), confirm the booking, and issue receipt.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Customer phone number" },
        txn_id: { type: "string", description: "bKash/Nagad transaction ID (e.g., BLA7X8Y9Z0)" },
        amount: { type: "number", description: "Optional paid amount in Taka" },
        method: { type: "string", enum: ["bkash", "nagad", "rocket", "bank", "cash"] },
        booking_id: { type: "string", description: "Optional specific booking ID" },
      },
      required: ["phone", "txn_id"],
    },
  },
  {
    name: "get_customer_profile",
    description: "Fetch CRM customer profile, lifetime value, total bookings, preferred turf/time, and segmentation status (VIP, Regular, New, Churned).",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Customer phone number" },
      },
      required: ["phone"],
    },
  },
  {
    name: "record_restock_order",
    description: "Record inventory stock replenishment for a shop product and notify admins.",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Product name (or keyword match)" },
        quantity: { type: "number", description: "Quantity of items added to stock" },
        cost_price: { type: "number", description: "Optional cost price per unit" },
        supplier_note: { type: "string", description: "Optional supplier or invoice note" },
      },
      required: ["product_name", "quantity"],
    },
  },
];
