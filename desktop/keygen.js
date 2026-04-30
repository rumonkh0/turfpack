#!/usr/bin/env node
/**
 * TurfSlot License Key Generator (PRIVATE — do NOT ship with the app).
 *
 * Usage:
 *   node desktop/keygen.js <machine-id>
 *
 * Example:
 *   node desktop/keygen.js abc123def456
 *   => License Key: 7f3a...
 */
import { generateLicenseKey } from "./license.js";

const machineId = process.argv[2];

if (!machineId) {
  console.error("❌ Usage: node desktop/keygen.js <machine-id>");
  console.error("   The machine ID is displayed on the app's activation screen.");
  process.exit(1);
}

const key = generateLicenseKey(machineId);

console.log("");
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                    TurfSlot License Key Generator                   ║");
console.log("╠══════════════════════════════════════════════════════════════════════╣");
console.log(`║  Machine ID:   ${machineId}`);
console.log(`║  License Key:  ${key}`);
console.log("╚══════════════════════════════════════════════════════════════════════╝");
console.log("");
