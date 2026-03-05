import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
  }).index("by_username", ["username"]),

  loginAttempts: defineTable({
    identifier: v.string(),
    attempts: v.number(),
    lastAttempt: v.number(),
    lockedUntil: v.number(),
  }).index("by_identifier", ["identifier"]),
});
