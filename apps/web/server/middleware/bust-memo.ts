import { bustMemo } from "../utils/memo";

// Any write (including MCP tool calls and the sync/cron jobs) drops the read
// cache, before the handler runs and again once it has finished, so the next
// read always sees the change.
export default defineEventHandler((event) => {
  const path = event.path ?? "";
  if (!path.startsWith("/api/")) return;
  const isRead = event.method === "GET" || event.method === "HEAD";
  // The cron route is a GET that writes.
  if (isRead && !path.startsWith("/api/cron/")) return;

  bustMemo();
  event.node.res.once("finish", bustMemo);
});
