import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import {
  listRecords,
  findById,
  createRecord,
  updateById,
  deleteById,
} from "../db/sqlite.js";

// @desc    Get all turfs
// @route   GET /api/turfs
// @access  Public
export const getTurfs = asyncHandler(async (req, res, next) => {
  const reqQuery = { ...req.query };
  const removeFields = ["select", "sort", "page", "limit"];
  removeFields.forEach((param) => delete reqQuery[param]);

  const filters = Object.entries(reqQuery).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  const where = filters.map(([key]) => `${key} = ?`).join(" AND ");
  const params = filters.map(([, value]) => value);

  const turfs = listRecords("turfs", {
    sort: req.query.sort || "-createdAt",
    limit: parseInt(req.query.limit, 10) || 500,
    where,
    params,
  });

  const selectedTurfs = req.query.select
    ? turfs.map((turf) => {
        const picked = {};
        req.query.select.split(",").forEach((field) => {
          const cleanField = field.trim();
          if (cleanField in turf) picked[cleanField] = turf[cleanField];
        });
        return picked;
      })
    : turfs;

  res
    .status(200)
    .json({ success: true, count: selectedTurfs.length, data: selectedTurfs });
});

// @desc    Get single turf
// @route   GET /api/turfs/:id
// @access  Public
export const getTurf = asyncHandler(async (req, res, next) => {
  const turf = findById("turfs", req.params.id);

  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.params.id}`, 404),
    );
  }

  res.status(200).json({ success: true, data: turf });
});

// @desc    Create new turf
// @route   POST /api/turfs
// @access  Private/Admin
export const createTurf = asyncHandler(async (req, res, next) => {
  const turf = createRecord("turfs", req.body);
  res.status(201).json({ success: true, data: turf });
});

// @desc    Update turf
// @route   PUT /api/turfs/:id
// @access  Private/Admin
export const updateTurf = asyncHandler(async (req, res, next) => {
  let turf = findById("turfs", req.params.id);

  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.params.id}`, 404),
    );
  }

  // Cleanup old image if replaced
  if (
    req.body.image_public_id &&
    turf.image_public_id &&
    req.body.image_public_id !== turf.image_public_id
  ) {
    await deleteFromCloudinary(turf.image_public_id);
  }

  turf = updateById("turfs", req.params.id, req.body);

  res.status(200).json({ success: true, data: turf });
});

// @desc    Delete turf
// @route   DELETE /api/turfs/:id
// @access  Private/Admin
export const deleteTurf = asyncHandler(async (req, res, next) => {
  const turf = findById("turfs", req.params.id);

  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.params.id}`, 404),
    );
  }

  // Delete image from Cloudinary
  if (turf.image_public_id) {
    await deleteFromCloudinary(turf.image_public_id);
  }

  deleteById("turfs", req.params.id);

  res.status(200).json({ success: true, data: {} });
});
