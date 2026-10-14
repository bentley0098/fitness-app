import { DEFAULT_ZONE, today } from "#shared/utils/calendar";

/**
 * Today for the runner: the device's zone in the browser, and the `tz` cookie
 * (falling back to Irish time) while rendering on the server, so both agree.
 */
export function useToday(): string {
  const zone = import.meta.client
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : useCookie<string | undefined>("tz").value ?? DEFAULT_ZONE;
  return today(new Date(), zone);
}
