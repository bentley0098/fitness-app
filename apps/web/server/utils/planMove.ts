import { mondayOf } from "./planMeta";

// Pure planning for "drag this session onto that day". No I/O — the endpoint
// executes whatever `steps` comes back with. A day can hold any number of
// sessions, so a move only ever relocates the one session.

export interface MovableSession {
  id: string;
  date: string;
}

export interface MoveStep {
  id: string;
  date: string;
  final: boolean;
}

export interface MoveOutcome {
  id: string;
  from: string;
  to: string;
}

export interface MovePlan {
  ok: boolean;
  /** Set when the move is refused; `steps` is empty. */
  error?: string;
  /** Dropped on the day it already occupies — nothing to write, not an error. */
  noop: boolean;
  steps: MoveStep[];
  moved: MoveOutcome | null;
}

function refuse(error: string): MovePlan {
  return { ok: false, error, noop: false, steps: [], moved: null };
}

/**
 * Work out the writes that move `session` onto `toDate`.
 *
 * Moves are confined to the session's own ISO week: that keeps every week's
 * planned volume exactly as it was.
 */
export function planSessionMove(session: MovableSession, toDate: string): MovePlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return refuse(`Not a calendar date: ${toDate}`);

  if (mondayOf(session.date) !== mondayOf(toDate)) {
    return refuse("Sessions can only be moved within their own week.");
  }

  if (toDate === session.date) {
    return { ok: true, noop: true, steps: [], moved: null };
  }

  return {
    ok: true,
    noop: false,
    steps: [{ id: session.id, date: toDate, final: true }],
    moved: { id: session.id, from: session.date, to: toDate },
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-09-23" -> "Wed 23 Sep". Parsed at UTC midnight like every other date
 * in this app, so a negative local offset can't shift the label back a day.
 */
export function formatMoveDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** What lands on the session card: where this session came from. */
export function movedFromLabel(from: string): string {
  return `Moved from ${formatMoveDate(from)}`;
}

/** What lands in the plan_revisions audit trail: the whole move. */
export function moveRationale(from: string, to: string): string {
  return `Moved from ${formatMoveDate(from)} to ${formatMoveDate(to)}`;
}
