import { expect, describe, it } from "vitest";
import { messagesReducer } from "../messagesReducer";
import { Message } from "../../types";

const msg = (id: number, createdAt: Message["createdAt"]): Message => ({
  id,
  body: `msg-${id}`,
  fromMe: false,
  createdAt,
});

describe("messagesReducer — sortByDate", () => {
  it("orders a unix-seconds timestamp correctly against ISO-dated messages, instead of collapsing it to 1970", () => {
    // 1722259200 = 2024-07-29T12:00:00Z in seconds -- earlier than both ISO
    // messages below, but interpreted as milliseconds (the pre-fix bug) it
    // becomes 1970-01-20, which would still sort first but for the wrong
    // reason and would break as soon as any ISO message predates 1970+20d.
    const unixSeconds = msg(1, 1722259200 as unknown as string);
    const isoMid = msg(2, "2026-01-01T00:00:00.000Z");
    const isoLate = msg(3, "2026-06-01T00:00:00.000Z");

    const state = messagesReducer([], {
      type: "LOAD_MESSAGES",
      payload: [isoLate, isoMid, unixSeconds],
    });

    expect(state.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("keeps a numeric createdAt from causing a 1970-style ordering bug against 2026 dates", () => {
    // Same value as above, but this time the ISO message predates it if
    // treated as milliseconds — proves the fix isn't accidentally correct
    // only because 1970 happens to sort first.
    const isoBefore1970Equivalent = msg(1, "1970-01-01T00:00:00.000Z");
    const unixSeconds = msg(2, 1722259200 as unknown as string);

    const state = messagesReducer([], {
      type: "LOAD_MESSAGES",
      payload: [unixSeconds, isoBefore1970Equivalent],
    });

    expect(state.map((m) => m.id)).toEqual([1, 2]);
  });

  it("still sorts correctly when all messages use ISO date strings", () => {
    const a = msg(1, "2026-01-01T00:00:00.000Z");
    const b = msg(2, "2026-03-01T00:00:00.000Z");
    const c = msg(3, "2026-05-01T00:00:00.000Z");

    const state = messagesReducer([], {
      type: "LOAD_MESSAGES",
      payload: [c, a, b],
    });

    expect(state.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("breaks a same-second timestamp tie deterministically by id (issue #414)", () => {
    // WhatsApp timestamps carry only second precision -- two messages sent
    // within the same second arrive with an identical createdAt. Without an
    // explicit tiebreak the resulting order depends on whatever order the
    // backend/network happened to deliver them in, which corrupts the
    // reply/reply-back flow shown in the chat.
    const same = "2026-07-30T12:00:00.000Z";
    const a = msg(2, same);
    const b = msg(10, same);
    const c = msg(1, same);

    const state = messagesReducer([], {
      type: "LOAD_MESSAGES",
      payload: [b, a, c],
    });

    // Tiebreak is string comparison of id (matches the backend's `id DESC`
    // tiebreak, reversed the same way createdAt is) -- "1" < "10" < "2" lexically.
    expect(state.map((m) => m.id)).toEqual([1, 10, 2]);
  });

  it("sorts correctly when timestamps are already in milliseconds", () => {
    const a = msg(1, 1700000000000 as unknown as string);
    const b = msg(2, 1750000000000 as unknown as string);

    const state = messagesReducer([], {
      type: "LOAD_MESSAGES",
      payload: [b, a],
    });

    expect(state.map((m) => m.id)).toEqual([1, 2]);
  });
});
