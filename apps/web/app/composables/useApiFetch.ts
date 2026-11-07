import { computed, toValue } from "vue";

// Why this exists: `await useFetch()` in <script setup> holds the route change
// until the API answers, so every tab press waited on a database round trip
// before anything moved. This never awaits, so navigation is instant and the
// page paints its skeleton straight away.
//
//   lazy + server:false  the shell renders immediately; the data is fetched
//                        once, in the browser. These screens are private and
//                        single-user, so there is nothing for SSR to add.
//   swr                  remember the last response per URL for the session and
//                        show it instantly on the next visit while a fresh copy
//                        loads. `pending` stays false when there is something
//                        to show, so no skeleton flashes over real content.
const seen = new Map<string, unknown>();

type Opts = Record<string, any> & { swr?: boolean };

export const useApiFetch = ((request: any, opts: Opts = {}) => {
  const { swr = false, ...rest } = opts;
  const key =
    rest.key ?? `${String(toValue(request))}?${JSON.stringify(toValue(rest.query) ?? {})}`;

  const result = useFetch(request, {
    lazy: true,
    server: false,
    ...rest,
    // Only pinned when remembering responses; otherwise Nuxt derives a key that
    // follows a reactive URL or query.
    ...(swr ? { key } : {}),
    ...(swr && import.meta.client && !rest.default ? { default: () => seen.get(key) ?? null } : {}),
    ...(swr && import.meta.client
      ? {
          onResponse: (ctx: any) => {
            if (ctx.response?.ok) seen.set(key, ctx.response._data);
            return rest.onResponse?.(ctx);
          },
        }
      : {}),
  }) as any;

  if (!swr) return result;
  return {
    ...result,
    // Only a first-ever visit with nothing to show counts as "loading".
    pending: computed(() => result.pending.value && result.data.value == null),
  };
}) as unknown as typeof useFetch;
