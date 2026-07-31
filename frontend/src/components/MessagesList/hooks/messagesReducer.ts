import { Message, MessagesAction } from "../types";

// createdAt is typed as string, but some messages arrive with a numeric unix
// timestamp in SECONDS (e.g. 1722259200) rather than an ISO date string or
// milliseconds. `new Date()` always expects milliseconds, so a raw seconds
// value gets interpreted as 1970 -- silently breaking the sort order against
// ISO-dated messages that land correctly in the current year. Detect a
// numeric value below the seconds/milliseconds threshold (10^12 ~= year
// 2001 in ms, comfortably above any real unix-seconds value) and scale it up.
const SECONDS_MS_THRESHOLD = 1e12;

const toTimestampMs = (createdAt: Message["createdAt"]): number => {
  const numeric = Number(createdAt);
  if (!Number.isNaN(numeric) && String(createdAt).trim() !== "") {
    return numeric < SECONDS_MS_THRESHOLD ? numeric * 1000 : numeric;
  }
  return new Date(createdAt).getTime();
};

// WhatsApp timestamps carry only second precision, so messages exchanged in
// the same second tie (toTimestampMs(a) === toTimestampMs(b)). Relying on
// Array.sort's stability to keep those ties in insertion order isn't
// reliable once the backend page itself already returned them without a
// deterministic tiebreak — so id (mirrors the backend's `id DESC` tiebreak,
// reversed the same way createdAt is) breaks ties explicitly here too.
const sortByDate = (arr: Message[]): Message[] =>
  [...arr].sort((a, b) => {
    const diff = toTimestampMs(a.createdAt) - toTimestampMs(b.createdAt);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });

export const messagesReducer = (
  state: Message[],
  action: MessagesAction
): Message[] => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload || [];
    const merged = [...state];
    messages.forEach((message) => {
      const idx = merged.findIndex((m) => m.id === message.id);
      if (idx !== -1) merged[idx] = message;
      else merged.push(message);
    });
    return sortByDate(merged);
  }
  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const idx = state.findIndex((m) => m.id === newMessage.id);
    const updated = [...state];
    if (idx !== -1) updated[idx] = newMessage;
    else updated.push(newMessage);
    return sortByDate(updated);
  }
  if (action.type === "UPDATE_MESSAGE") {
    const idx = state.findIndex((m) => m.id === action.payload.id);
    if (idx === -1) return state;
    const updated = [...state];
    updated[idx] = action.payload;
    return sortByDate(updated);
  }
  if (action.type === "RESET") return [];
  return state;
};
