import { mutation } from "./_generated/server";
import { v } from "convex/values";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  hash = ((hash >>> 0) * 2654435761) >>> 0;
  return hash.toString(36);
}

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

export const login = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, { username, password }) => {
    const normalized = username.toLowerCase().trim();
    const now = Date.now();

    const record = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier", (q) => q.eq("identifier", normalized))
      .first();

    if (record && record.lockedUntil > now) {
      const remaining = Math.ceil((record.lockedUntil - now) / 1000);
      return { ok: false, error: `Locked out. Try again in ${remaining}s.`, locked: true, remaining };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();

    const hash = simpleHash(password);

    if (!user || hash !== user.passwordHash) {
      const newAttempts = (record ? record.attempts : 0) + 1;
      const lockUntil = now + lockoutDuration(newAttempts);

      if (record) {
        await ctx.db.patch(record._id, {
          attempts: newAttempts,
          lastAttempt: now,
          lockedUntil: lockUntil,
        });
      } else {
        await ctx.db.insert("loginAttempts", {
          identifier: normalized,
          attempts: newAttempts,
          lastAttempt: now,
          lockedUntil: lockUntil,
        });
      }

      return { ok: false, error: "Invalid credentials." };
    }

    if (record) {
      await ctx.db.patch(record._id, { attempts: 0, lockedUntil: 0 });
    }

    return { ok: true, username: user.username };
  },
});

export const seed = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, { username, password }) => {
    const normalized = username.toLowerCase().trim();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();

    if (existing) {
      return { ok: false, error: "User already exists." };
    }

    const passwordHash = simpleHash(password);
    await ctx.db.insert("users", { username: normalized, passwordHash });
    return { ok: true, username: normalized };
  },
});
