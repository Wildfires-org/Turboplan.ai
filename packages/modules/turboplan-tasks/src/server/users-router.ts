/**
 * Users router
 * Provides REST API endpoints for users
 */
import { Hono } from "hono";

import { DrizzleUserRepository } from "./repository";

// Create a new Hono router
const router = new Hono();

// Initialize repository
const userRepository = new DrizzleUserRepository();

/**
 * GET /users
 * Get all users (authenticated endpoint)
 */
router.get("/", async (c) => {
  try {
    const users = await userRepository.findAll();
    return c.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

export default router;
