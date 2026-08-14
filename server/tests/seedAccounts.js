export const seedAccounts = [
      // Assets (1xxx)
      { code: "1001", name: "Cash - bKash", type: "asset", normal_side: "debit", description: "Mobile banking - bKash" },
      { code: "1002", name: "Cash - Nagad", type: "asset", normal_side: "debit", description: "Mobile banking - Nagad" },
      { code: "1003", name: "Cash - Rocket", type: "asset", normal_side: "debit", description: "Mobile banking - Rocket" },
      { code: "1004", name: "Cash - Physical", type: "asset", normal_side: "debit", description: "Physical cash on hand" },
      { code: "1005", name: "Cash - Card", type: "asset", normal_side: "debit", description: "Card terminal receipts" },
      { code: "1006", name: "Cash - Other", type: "asset", normal_side: "debit", description: "Other payment channels" },
      { code: "1100", name: "Accounts Receivable", type: "asset", normal_side: "debit", description: "Unpaid/partial booking balances" },
      { code: "1200", name: "Inventory", type: "asset", normal_side: "debit", description: "Product stock at cost" },
      // Liabilities (2xxx)
      { code: "2001", name: "Accounts Payable", type: "liability", normal_side: "credit", description: "Unpaid obligations" },
      // Equity (3xxx)
      { code: "3000", name: "Retained Earnings", type: "equity", normal_side: "credit", description: "Accumulated net profit" },
      { code: "3100", name: "Partner Drawings", type: "equity", normal_side: "debit", description: "Payouts to partners (contra-equity)" },
      // Revenue (4xxx)
      { code: "4001", name: "Booking Revenue", type: "revenue", normal_side: "credit", description: "Turf rental income" },
      { code: "4002", name: "Product Sales Revenue", type: "revenue", normal_side: "credit", description: "POS/retail product sales" },
      { code: "4003", name: "Tournament Revenue", type: "revenue", normal_side: "credit", description: "Tournament entry fees" },
      { code: "4099", name: "Miscellaneous Revenue", type: "revenue", normal_side: "credit", description: "Other income (sponsorships, etc.)" },
      // COGS (5xxx)
      { code: "5001", name: "Cost of Goods Sold", type: "cogs", normal_side: "debit", description: "Product cost basis on sale" },
      // Expenses (6xxx)
      { code: "6001", name: "Rent", type: "expense", normal_side: "debit", description: "Venue/space rental" },
      { code: "6002", name: "Utilities", type: "expense", normal_side: "debit", description: "Electric, water, internet" },
      { code: "6003", name: "Salaries & Wages", type: "expense", normal_side: "debit", description: "Staff compensation" },
      { code: "6004", name: "Maintenance", type: "expense", normal_side: "debit", description: "Turf/facility upkeep" },
      { code: "6005", name: "Marketing", type: "expense", normal_side: "debit", description: "Advertising, promotions" },
      { code: "6006", name: "Equipment", type: "expense", normal_side: "debit", description: "Gear, tools, hardware" },
      { code: "6099", name: "Miscellaneous Expense", type: "expense", normal_side: "debit", description: "Uncategorized expenses" },
    ];