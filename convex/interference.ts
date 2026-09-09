import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Interference: an admin in the hub terminal forces the theme of every open
 * hub tab.
 *
 * One row, `key = "hub"`. `get` is public because it is what the page shows;
 * `set` is gated on a session token minted by `auth:login`, because the only
 * other evidence of a login is a variable in the page's own JavaScript and a
 * mutation cannot check that.
 */

const KEY = "hub";

/** Deliberately narrower than the header kit's list. The kit is the client's
 *  authority on which themes exist; this is the server refusing to store
 *  anything that is not shaped like a theme id, whatever the kit ships next. */
const THEME_RE = /^[a-z][a-z0-9-]{0,23}$/;

const NOT_SIGNED_IN = "Not signed in.";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("interference")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    if (!row) return null;
    return { theme: row.theme, seq: row.seq, by: row.by, at: row.at };
  },
});

export const set = mutation({
  args: { token: v.string(), theme: v.union(v.string(), v.null()) },
  handler: async (ctx, { token, theme }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error(NOT_SIGNED_IN);

    /* Re-check the user, not just the token. A user removed with the CLI
       loses the power at once, even while holding a token that has not
       expired yet. Same message either way: which of the two failed is not
       the caller's business. */
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", session.username))
      .first();
    if (!user) throw new Error(NOT_SIGNED_IN);

    if (theme !== null && !THEME_RE.test(theme)) throw new Error("Bad theme.");

    const now = Date.now();
    const row = await ctx.db
      .query("interference")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();

    /* seq climbs on every write, including a write of the same theme, so a
       subscribed tab can tell a fresh order from the value it already holds
       and knows whether it owes the viewer a burst. */
    if (row) {
      const seq = row.seq + 1;
      await ctx.db.patch(row._id, { theme, seq, by: session.username, at: now });
      return { theme, seq };
    }
    await ctx.db.insert("interference", {
      key: KEY,
      theme,
      seq: 1,
      by: session.username,
      at: now,
    });
    return { theme, seq: 1 };
  },
});
