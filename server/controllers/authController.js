import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";
import prisma, { getSetting, setSetting } from "../db/prismaClient.js";

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
  const { full_name, email, password, role } = req.body;

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    return next(new ErrorResponse("User already exists", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      full_name,
      email,
      password: hashedPassword,
      role,
    }
  });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse("Please provide an email and password", 400));
  }

  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Desktop trusted auto-login (license-gated)
// @route   POST /api/auth/desktop-auto-login
// @access  Public (desktop only)
export const desktopAutoLogin = asyncHandler(async (req, res, next) => {
  if (process.env.DESKTOP_TRUSTED_MODE !== "true") {
    return next(new ErrorResponse("Route not available", 404));
  }

  if (process.env.LICENSE_STATUS !== "active") {
    return next(new ErrorResponse("License activation required", 403));
  }

  const configuredEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@admin.com";
  const configuredName = process.env.DEFAULT_ADMIN_NAME || "Desktop Admin";
  const configuredPassword = process.env.DEFAULT_ADMIN_PASSWORD || "00000000";

  let user = null;
  const desktopUserId = await getSetting("desktop_user_id");

  const ensureAdminUser = async (candidate) => {
    if (!candidate) return null;

    if (candidate.role !== "admin" || candidate.status !== "active") {
      candidate = await prisma.user.update({
        where: { id: candidate.id },
        data: { role: "admin", status: "active" }
      });
    }

    return candidate;
  };

  // Prefer the configured desktop admin account
  user = await ensureAdminUser(
    await prisma.user.findFirst({ where: { email: configuredEmail } })
  );

  // Fallback to persisted desktop user
  if (!user && desktopUserId) {
    user = await ensureAdminUser(
      await prisma.user.findUnique({ where: { id: desktopUserId } })
    );
  }

  // Last chance fallback
  if (!user) {
    user = await ensureAdminUser(
      await prisma.user.findFirst({ where: { email: "admin@admin.com" } })
    );
  }

  if (!user) {
    const hashedPassword = await bcrypt.hash(configuredPassword, 10);
    user = await prisma.user.create({
      data: {
        full_name: configuredName,
        email: configuredEmail,
        password: hashedPassword,
        role: "admin",
        status: "active",
      }
    });
  }

  await setSetting("desktop_user_id", user.id);
  sendTokenResponse(user, 200, res);
});

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.status(200).json({ success: true, data: user });
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  // Set secure cookie only if using HTTPS (not for local desktop app)
  if (process.env.NODE_ENV === "production" && !process.env.SQLITE_PATH) {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
};
