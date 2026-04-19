import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

const localUploadDir =
  process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), "server/uploads");

if (!hasCloudinaryConfig && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "turfslot",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, localUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMime = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype || "");
  if (!allowedMime) {
    return cb(new Error("Only image files are allowed (jpg, jpeg, png, webp)"));
  }
  cb(null, true);
};

const upload = multer({
  storage: hasCloudinaryConfig ? cloudinaryStorage : diskStorage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

export default upload;
