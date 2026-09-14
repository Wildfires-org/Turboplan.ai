import { createTestUserWithMagicLink } from "../utils/test-auth";

const email = process.argv[2] ?? "mcp-test@turboplan.test";
const baseUrl = process.argv[3] ?? "http://localhost:3000";

const { user, magicLinkUrl } = await createTestUserWithMagicLink(
  email,
  baseUrl,
);
console.log(JSON.stringify({ user, magicLinkUrl }, null, 2));
process.exit(0);
