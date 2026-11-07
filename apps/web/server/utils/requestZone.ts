import { getCookie, type H3Event } from "h3";
import { resolveZone, today } from "../../shared/utils/calendar";

// The runner's zone comes from their device: a client plugin writes it to the
// `tz` cookie and every request carries it. A cookie rather than a header or a
// stored setting because the app is single-user today and this reaches SSR and
// every route with no per-route wiring. If the app goes multi-user, this is
// the one place to read a profile zone instead.
export function requestZone(event: H3Event): string {
  return resolveZone(getCookie(event, "tz"));
}

/** Today for the runner making this request. */
export function requestToday(event: H3Event, now: Date = new Date()): string {
  return today(now, requestZone(event));
}
