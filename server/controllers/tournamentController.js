import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma from "../db/prismaClient.js";

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Private
export const getTournaments = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const tournaments = await prisma.tournament.findMany({
    orderBy,
    take: limit,
  });

  res
    .status(200)
    .json({ success: true, count: tournaments.length, data: tournaments });
});

// @desc    Create tournament
// @route   POST /api/tournaments
// @access  Private/Admin
export const createTournament = asyncHandler(async (req, res, next) => {
  const tournament = await prisma.tournament.create({ data: req.body });
  res.status(201).json({ success: true, data: tournament });
});

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private/Admin
export const updateTournament = asyncHandler(async (req, res, next) => {
  let tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });

  if (!tournament) {
    return next(
      new ErrorResponse(
        `Tournament not found with id of ${req.params.id}`,
        404,
      ),
    );
  }

  tournament = await prisma.tournament.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.status(200).json({ success: true, data: tournament });
});

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private/Admin
export const deleteTournament = asyncHandler(async (req, res, next) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });

  if (!tournament) {
    return next(
      new ErrorResponse(
        `Tournament not found with id of ${req.params.id}`,
        404,
      ),
    );
  }

  await prisma.tournament.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
