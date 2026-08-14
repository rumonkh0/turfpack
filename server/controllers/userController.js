import bcrypt from "bcryptjs";
import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import prisma from "../db/prismaClient.js";

// @desc    Create user (Admin only)
// @route   POST /api/users
// @access  Private/Admin
export const createUser = asyncHandler(async (req, res, next) => {
  const { full_name, email, password, role, image_url, image_public_id } =
    req.body;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return next(new ErrorResponse("User already exists", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      full_name,
      email,
      password: hashedPassword,
      role: role || "staff",
      image_url,
      image_public_id,
    }
  });

  res.status(201).json({
    success: true,
    data: user,
  });
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const users = await prisma.user.findMany({
    orderBy,
    take: limit,
  });

  res.status(200).json({ success: true, count: users.length, data: users });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404),
    );
  }

  res.status(200).json({ success: true, data: user });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404),
    );
  }

  // Cleanup old image if replaced
  if (
    req.body.image_public_id &&
    user.image_public_id &&
    req.body.image_public_id !== user.image_public_id
  ) {
    await deleteFromCloudinary(user.image_public_id);
  }

  const updates = { ...req.body };

  // If password is blank or not provided, remove it from update
  if (updates.password === "" || !updates.password) {
    delete updates.password;
  } else {
    updates.password = await bcrypt.hash(updates.password, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.params.id },
    data: updates,
  });

  res.status(200).json({ success: true, data: updatedUser });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    return next(
      new ErrorResponse(`User not found with id of ${req.params.id}`, 404),
    );
  }

  // Delete image from Cloudinary
  if (user.image_public_id) {
    await deleteFromCloudinary(user.image_public_id);
  }

  await prisma.user.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
