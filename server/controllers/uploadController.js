import asyncHandler from "../middleware/async.js";
import ErrorResponse from "../utils/errorResponse.js";

// @desc    Upload file
// @route   POST /api/upload
// @access  Private
export const uploadFile = asyncHandler(async (req, res, next) => {
  console.log("Upload request received");
  console.log("File:", req.file);

  if (!req.file) {
    return next(new ErrorResponse("Please upload a file", 400));
  }

  const isCloudinaryUpload =
    typeof req.file.path === "string" && req.file.path.startsWith("http");
  const localFileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.status(200).json({
    success: true,
    data: {
      file_url: isCloudinaryUpload ? req.file.path : localFileUrl,
      public_id: isCloudinaryUpload
        ? req.file.filename
        : `local:${req.file.filename}`,
    },
  });
});
