import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  testEnvironment: "jest-environment-node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

module.exports = async () => ({
  ...(await createJestConfig(config)()),
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
});
