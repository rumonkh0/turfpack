import { getSetting, setSetting } from "../db/prismaClient.js";

/**
 * @desc    Get license status and machine ID
 * @route   GET /api/license/status
 * @access  Public (desktop only)
 */
export const getLicenseStatus = (req, res) => {
  const machineId = process.env.MACHINE_ID || null;
  const licenseStatus = process.env.LICENSE_STATUS || "inactive";

  res.status(200).json({
    success: true,
    data: {
      activated: licenseStatus === "active",
      machineId,
    },
  });
};

/**
 * @desc    Activate license with a key
 * @route   POST /api/license/activate
 * @access  Public (desktop only)
 */
export const activateLicense = async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({
      success: false,
      error: "Please provide a license key.",
    });
  }

  const machineId = process.env.MACHINE_ID;
  if (!machineId) {
    return res.status(500).json({
      success: false,
      error: "Machine ID not available.",
    });
  }

  // Dynamically import the license module from the desktop folder
  try {
    const { verifyLicense } = await import("../../desktop/license.js");

    if (!verifyLicense(machineId, licenseKey)) {
      return res.status(400).json({
        success: false,
        error: "Invalid license key for this machine.",
      });
    }

    // Store the valid key in the database
    await setSetting("license_key", licenseKey);

    // Update the runtime status
    process.env.LICENSE_STATUS = "active";

    return res.status(200).json({
      success: true,
      data: { activated: true },
    });
  } catch (err) {
    console.error("License activation error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to verify license.",
    });
  }
};
