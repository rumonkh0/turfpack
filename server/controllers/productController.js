import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import prisma from "../db/prismaClient.js";

// @desc    Get all products
// @route   GET /api/products
// @access  Private
export const getProducts = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 500;
  let orderBy = { created_at: "desc" };
  if (req.query.sort) {
    const isDesc = req.query.sort.startsWith("-");
    const rawField = req.query.sort.replace("-", "");
    const field = ["createdAt", "created_date", "created_at"].includes(rawField) ? "created_at" : rawField;
    orderBy = { [field]: isDesc ? "desc" : "asc" };
  }

  const products = await prisma.product.findMany({
    orderBy,
    take: limit,
  });

  res
    .status(200)
    .json({ success: true, count: products.length, data: products });
});

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res, next) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ success: true, data: product });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res, next) => {
  let product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404),
    );
  }

  // Cleanup old image if replaced
  if (
    req.body.image_public_id &&
    product.image_public_id &&
    req.body.image_public_id !== product.image_public_id
  ) {
    await deleteFromCloudinary(product.image_public_id);
  }

  product = await prisma.product.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.status(200).json({ success: true, data: product });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404),
    );
  }

  // Delete image from Cloudinary
  if (product.image_public_id) {
    await deleteFromCloudinary(product.image_public_id);
  }

  await prisma.product.delete({ where: { id: req.params.id } });

  res.status(200).json({ success: true, data: {} });
});
