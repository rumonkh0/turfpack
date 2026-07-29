import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    testTimeout: 15000,
    pool: "forks",
    singleFork: true,
  },
});
