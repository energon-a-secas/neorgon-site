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

  /**
   * Server-side proof that a browser logged in.
   *
   * `login` used to return only `{ ok, username }`, so the whole "session" was
   * the string `authedUser` inside terminal.js's closure: a fact the page owns
   * and any script on it could imitate. A mutation cannot trust that, so a
   * login now mints a token here and a privileged mutation looks it up.
   */
  sessions: defineTable({
    token: v.string(),
    username: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  /**
   * Exactly one row, `key = "hub"`. `theme` is the forced theme id, or null
   * when released. `seq` increments on every write, including a write of the
   * same theme, so a subscribed tab can tell a fresh order from a value it
   * already holds. `by` and `at` are what `interfere` reads back.
   */
  interference: defineTable({
    key: v.string(),
    theme: v.union(v.string(), v.null()),
    seq: v.number(),
    by: v.string(),
    at: v.number(),
  }).index("by_key", ["key"]),
});
