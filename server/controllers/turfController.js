import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import prisma from "../db/prismaClient.js";

// @desc    Get all turfs
// @route   GET /api/turfs
// @access  Public
export const getTurfs = asyncHandler(async (req, res, next) => {
  const reqQuery = { ...req.query };
  const removeFields = ["select", "sort", "page", "limit"];
  removeFields.forEach((param) => delete reqQuery[param]);

  const limit = parseInt(req.query.limit, 10) || 500;
  
  // Sort
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  // Filter
  const where = {};
  for (const [key, value] of Object.entries(reqQuery)) {
    if (value !== undefined && value !== "") {
      where[key] = value;
    }
  }

  // Select
  let select = undefined;
  if (req.query.select) {
    select = {};
    req.query.select.split(",").forEach((field) => {
      const cleanField = field.trim();
      select[cleanField] = true;
    });
  }

  const turfs = await prisma.turf.findMany({
    where,
    orderBy,
    take: limit,
    ...(select ? { select } : {})
  });

  res
    .status(200)
    .json({ success: true, count: turfs.length, data: turfs });
});

// @desc    Get single turf
// @route   GET /api/turfs/:id
// @access  Public
export const getTurf = asyncHandler(async (req, res, next) => {
  const turf = await prisma.turf.findUnique({ where: { id: req.params.id } });

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
  const turf = await prisma.turf.create({ data: req.body });
  res.status(201).json({ success: true, data: turf });
});

// @desc    Update turf
// @route   PUT /api/turfs/:id
// @access  Private/Admin
export const updateTurf = asyncHandler(async (req, res, next) => {
  let turf = await prisma.turf.findUnique({ where: { id: req.params.id } });

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

  turf = await prisma.turf.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.status(200).json({ success: true, data: turf });
});

// @desc    Delete turf
// @route   DELETE /api/turfs/:id
// @access  Private/Admin
export const deleteTurf = asyncHandler(async (req, res, next) => {
  const turf = await prisma.turf.findUnique({ where: { id: req.params.id } });

  if (!turf) {
    return next(
      new ErrorResponse(`Turf not found with id of ${req.params.id}`, 404),
    );
  }

  // Delete image from Cloudinary
  if (turf.image_public_id) {
    await deleteFromCloudinary(turf.image_public_id);
  }

  await prisma.turf.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
