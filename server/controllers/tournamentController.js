import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import {
  listRecords,
  createRecord,
  findById,
  updateById,
  deleteById,
} from "../db/sqlite.js";

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Private
export const getTournaments = asyncHandler(async (req, res, next) => {
  const tournaments = listRecords("tournaments", {
    sort: req.query.sort || "-createdAt",
    limit: parseInt(req.query.limit, 10) || 500,
  });
  res
    .status(200)
    .json({ success: true, count: tournaments.length, data: tournaments });
});

// @desc    Create tournament
// @route   POST /api/tournaments
// @access  Private/Admin
export const createTournament = asyncHandler(async (req, res, next) => {
  const tournament = createRecord("tournaments", req.body);
  res.status(201).json({ success: true, data: tournament });
});

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private/Admin
export const updateTournament = asyncHandler(async (req, res, next) => {
  let tournament = findById("tournaments", req.params.id);

  if (!tournament) {
    return next(
      new ErrorResponse(
        `Tournament not found with id of ${req.params.id}`,
        404,
      ),
    );
  }

  tournament = updateById("tournaments", req.params.id, req.body);

  res.status(200).json({ success: true, data: tournament });
});

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private/Admin
export const deleteTournament = asyncHandler(async (req, res, next) => {
  const tournament = findById("tournaments", req.params.id);

  if (!tournament) {
    return next(
      new ErrorResponse(
        `Tournament not found with id of ${req.params.id}`,
        404,
      ),
    );
  }

  deleteById("tournaments", req.params.id);

  res.status(200).json({ success: true, data: {} });
});
