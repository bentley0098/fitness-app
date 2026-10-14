// Tells the server which zone this device is in, so "today" on every request
// is the runner's today. Read back by server/utils/requestZone.ts.
export default defineNuxtPlugin(() => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cookie = useCookie("tz", { maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (zone && cookie.value !== zone) cookie.value = zone;
});
