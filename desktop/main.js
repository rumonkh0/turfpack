import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import connectDB from "../server/config/db.js";

// Disable sandbox to avoid SUID errors on Linux
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");
app.commandLine.appendSwitch("disable-dev-shm-usage");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let appPort = Number(process.env.PORT || 5000);
let expressApp;

const startApiServer = async () => {
  // Set production environment variables
  process.env.NODE_ENV = "production";
  process.env.SERVE_CLIENT = "true";
  process.env.JWT_SECRET = "supersecretkey_change_me_in_production";
  process.env.DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Rumon";
  process.env.DEFAULT_ADMIN_EMAIL =
    process.env.DEFAULT_ADMIN_EMAIL || "rumon@turfslot.com";
  process.env.DEFAULT_ADMIN_PASSWORD =
    process.env.DEFAULT_ADMIN_PASSWORD || "00000000";

  // Cloudinary configuration
  process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
  process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
  process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

  // Set writable database path
  const userDataPath = app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  process.env.SQLITE_PATH = path.join(dbDir, "turfslot.sqlite");
  process.env.LOCAL_UPLOAD_DIR = path.join(userDataPath, "uploads");
  if (!fs.existsSync(process.env.LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(process.env.LOCAL_UPLOAD_DIR, { recursive: true });
  }

  // Import server app only after env vars are ready.
  // app.js reads NODE_ENV/SERVE_CLIENT at module initialization.
  if (!expressApp) {
    const appModule = await import("../server/app.js");
    expressApp = appModule.default;
  }

  await connectDB();

  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const candidate = expressApp.listen(port, "127.0.0.1", () => {
        appPort = port;
        server = candidate;
        console.log(`✅ Desktop API listening on http://127.0.0.1:${appPort}`);
        resolve();
      });

      candidate.on("error", (err) => {
        if (err?.code === "EADDRINUSE" && port < 5100) {
          tryListen(port + 1);
          return;
        }
        reject(err);
      });
    };

    tryListen(appPort);
  });
};

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 840,
    minWidth: 1080,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${appPort}`);
};

app.whenReady().then(async () => {
  try {
    // Ensure we are in production mode for the server
    process.env.NODE_ENV = "production";
    process.env.SERVE_CLIENT = "true";

    // Set a writable database path in the user's data directory
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "data");

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    process.env.SQLITE_PATH = path.join(dbDir, "turfslot.sqlite");
    console.log(`Setting database path to: ${process.env.SQLITE_PATH}`);

    await startApiServer();
    await createWindow();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });
  } catch (error) {
    console.error("Failed to launch desktop app:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (server) {
    server.close();
  }
});
