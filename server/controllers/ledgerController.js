import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";

export const getJournalEntries = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.from || req.query.to) {
    where.entry_date = {};
    if (req.query.from) where.entry_date.gte = req.query.from;
    if (req.query.to) where.entry_date.lte = req.query.to;
  }
  if (req.query.reference_type) {
    where.reference_type = req.query.reference_type;
  }

  const limit = parseInt(req.query.limit, 10) || 100;

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [
      { entry_date: 'desc' },
      { created_at: 'desc' }
    ],
    take: limit,
    include: {
      lines: {
        orderBy: { debit: 'desc' }
      }
    }
  });

  const data = [];
  for (const entry of entries) {
    let totalDebit = 0;
    let totalCredit = 0;
    
    const linesWithAccount = await Promise.all(entry.lines.map(async (l) => {
      totalDebit += l.debit;
      totalCredit += l.credit;
      
      let account_name = null;
      if (l.account_code) {
        const account = await prisma.account.findUnique({ where: { code: l.account_code } });
        if (account) account_name = account.name;
      }

      return {
        account_code: l.account_code,
        account_name,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      };
    }));

    data.push({
      _id: entry.id,
      ...entry,
      lines: undefined,
      createdAt: entry.created_at,
      lines: linesWithAccount,
      total_debit: totalDebit,
      total_credit: totalCredit,
    });
  }

  res.status(200).json({ success: true, count: data.length, data });
});

export const getJournalEntry = asyncHandler(async (req, res, next) => {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: req.params.id },
    include: {
      lines: {
        orderBy: { debit: 'desc' }
      }
    }
  });

  if (!entry) return next(new ErrorResponse("Journal entry not found", 404));

  let totalDebit = 0;
  let totalCredit = 0;
  
  const linesWithAccount = await Promise.all(entry.lines.map(async (l) => {
    totalDebit += l.debit;
    totalCredit += l.credit;
    
    let account_name = null;
    if (l.account_code) {
      const account = await prisma.account.findUnique({ where: { code: l.account_code } });
      if (account) account_name = account.name;
    }

    return {
      account_code: l.account_code,
      account_name,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
    };
  }));

  res.status(200).json({
    success: true,
    data: {
      _id: entry.id,
      ...entry,
      lines: undefined,
      createdAt: entry.created_at,
      lines: linesWithAccount,
      total_debit: totalDebit,
      total_credit: totalCredit,
    },
  });
});
