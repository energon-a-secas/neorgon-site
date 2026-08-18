"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { compare, hash } from "bcryptjs";

/**
 * Admin terminal auth.
 *
 * Previously this used a 32-bit djb2 hash written inline — a 2^32 space with
 * no salt and no work factor, invertible in seconds, where any colliding
 * string authenticated. It is bcrypt now, which needs the Node runtime, so
 * this file is an action and its database work lives in authDb.ts.
 *
 * Existing users were stored with the old hash and CANNOT be verified here.
 * Re-seed each one:
 *   npx convex run auth:seedAdmin '{"username":"you","password":"..."}'
 */

const BCRYPT_ROUNDS = 12;

/** Same message whether the user is unknown or the password is wrong. */
const GENERIC_ERROR = "Invalid credentials.";

/** Annotated explicitly: an action referencing internal.* from its own api
 *  module is circular, and TS gives up inferring the handler's return. */
type LoginResult =
  | { ok: true; username: string | null }
  | { ok: false; error: string; locked?: boolean; remaining?: number };

type SeedResult = { ok: true; username: string; created: boolean };

export const login = action({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, { username, password }): Promise<LoginResult> => {
    const normalized = username.toLowerCase().trim();

    if (password.length === 0 || password.length > 200) {
      return { ok: false as const, error: GENERIC_ERROR };
    }

    const state: any = await ctx.runQuery(internal.authDb.lookup, { username: normalized });

    if (state.locked) {
      return {
        ok: false as const,
        error: `Locked out. Try again in ${state.remaining}s.`,
        locked: true,
        remaining: state.remaining,
      };
    }

    // Compare even when the user is unknown, so a missing account and a wrong
    // password take the same time and cannot be told apart by timing.
    const stored = state.passwordHash ?? "$2a$12$" + "x".repeat(53);
    let valid = false;
    try {
      valid = await compare(password, stored);
    } catch {
      valid = false; // legacy djb2 hash: not a bcrypt string, never verifies
    }

    if (!state.passwordHash || !valid) {
      await ctx.runMutation(internal.authDb.recordFailure, { username: normalized });
      return { ok: false as const, error: GENERIC_ERROR };
    }

    await ctx.runMutation(internal.authDb.clearFailures, { username: normalized });
    return { ok: true as const, username: state.username };
  },
});

/**
 * Creates or re-points an admin account. Internal on purpose: it used to be a
 * public mutation, so anyone able to reach the deployment could mint a user
 * for any username that did not already exist. Run it from the CLI:
 *   npx convex run auth:seedAdmin '{"username":"you","password":"..."}'
 */
export const seedAdmin = internalAction({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, { username, password }): Promise<SeedResult> => {
    const normalized = username.toLowerCase().trim();
    if (password.length < 12) {
      throw new Error("Refusing to seed: password must be at least 12 characters.");
    }
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const result: { created: boolean } = await ctx.runMutation(internal.authDb.upsertUser, {
      username: normalized,
      passwordHash,
    });
    return { ok: true, username: normalized, created: result.created };
  },
});
