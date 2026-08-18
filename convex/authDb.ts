import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Database half of admin auth.
 *
 * Password hashing needs the Node runtime ("use node"), which mutations
 * cannot declare — so auth.ts is an action and every database touch it needs
 * lives here as an internal function.
 */

const LOCKOUT_TIERS = [
  { threshold: 3, duration: 30_000 },
  { threshold: 5, duration: 120_000 },
  { threshold: 8, duration: 600_000 },
  { threshold: 10, duration: 1_800_000 },
];

function lockoutDuration(attempts: number): number {
  let duration = 0;
  for (const tier of LOCKOUT_TIERS) {
    if (attempts >= tier.threshold) duration = tier.duration;
  }
  return duration;
}

export const lookup = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const now = Date.now();
    const record = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier", (q) => q.eq("identifier", username))
      .first();

    if (record && record.lockedUntil > now) {
      return { locked: true as const, remaining: Math.ceil((record.lockedUntil - now) / 1000) };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    return {
      locked: false as const,
      passwordHash: user?.passwordHash ?? null,
      username: user?.username ?? null,
    };
  },
});

export const recordFailure = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const now = Date.now();
    const record = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier", (q) => q.eq("identifier", username))
      .first();

    const attempts = (record ? record.attempts : 0) + 1;
    const lockedUntil = now + lockoutDuration(attempts);

    if (record) {
      await ctx.db.patch(record._id, { attempts, lastAttempt: now, lockedUntil });
    } else {
      await ctx.db.insert("loginAttempts", { identifier: username, attempts, lastAttempt: now, lockedUntil });
    }
  },
});

export const clearFailures = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const record = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier", (q) => q.eq("identifier", username))
      .first();
    if (record) await ctx.db.patch(record._id, { attempts: 0, lockedUntil: 0 });
  },
});

export const upsertUser = internalMutation({
  args: { username: v.string(), passwordHash: v.string() },
  handler: async (ctx, { username, passwordHash }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { passwordHash });
      return { created: false };
    }
    await ctx.db.insert("users", { username, passwordHash });
    return { created: true };
  },
});
