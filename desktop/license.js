/**
 * License verification module for TurfSlot Desktop.
 *
 * Uses HMAC-SHA256 to generate and verify hardware-locked license keys.
 * The secret salt is embedded here so it ships inside the ASAR archive,
 * making it difficult for casual users to extract.
 */
import crypto from "crypto";
import machineIdPkg from "node-machine-id";
const { machineIdSync } = machineIdPkg;

// ─── Secret salt – only you (the developer) know this ───────────────
const LICENSE_SALT = "TURFSLOT_NIVROSYS_LIC_2026_xK9mPq";

/**
 * Get the unique hardware identifier for this computer.
 * @returns {string} A 64-character hex string derived from the machine UUID.
 */
export const getMachineId = () => {
  try {
    return machineIdSync({ original: true });
  } catch (err) {
    console.error("Failed to read machine ID:", err.message);
    return "UNKNOWN";
  }
};

/**
 * Generate a license key for a given machine ID.
 * @param {string} machineId - The target machine's hardware ID.
 * @returns {string} The license key (64-char hex HMAC-SHA256).
 */
export const generateLicenseKey = (machineId) => {
  return crypto
    .createHmac("sha256", LICENSE_SALT)
    .update(machineId)
    .digest("hex");
};

/**
 * Verify whether a license key is valid for the current machine.
 * @param {string} machineId - The current machine's hardware ID.
 * @param {string} licenseKey - The key to verify.
 * @returns {boolean} True if the key is valid.
 */
export const verifyLicense = (machineId, licenseKey) => {
  if (!machineId || !licenseKey) return false;
  const expected = generateLicenseKey(machineId);
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(licenseKey, "hex"),
    );
  } catch {
    return false;
  }
};
