import { computed, onBeforeUnmount, ref } from "vue";

// A countdown between sets. Tracks an end time rather than counting ticks, so a
// phone that throttles the page while it is locked still shows the right time
// when it wakes.
export function useRestTimer() {
  const endsAt = ref<number | null>(null);
  const now = ref(Date.now());
  let interval: ReturnType<typeof setInterval> | null = null;

  const remaining = computed(() => (endsAt.value === null ? 0 : Math.max(0, Math.ceil((endsAt.value - now.value) / 1000))));
  const active = computed(() => endsAt.value !== null);

  function stop() {
    if (interval) clearInterval(interval);
    interval = null;
    endsAt.value = null;
  }

  function tick() {
    now.value = Date.now();
    if (endsAt.value !== null && now.value >= endsAt.value) {
      navigator.vibrate?.([200, 100, 200]);
      stop();
    }
  }

  function start(seconds: number) {
    stop();
    now.value = Date.now();
    endsAt.value = now.value + seconds * 1000;
    interval = setInterval(tick, 250);
  }

  function extend(seconds: number) {
    if (endsAt.value !== null) endsAt.value += seconds * 1000;
  }

  onBeforeUnmount(stop);

  return { remaining, active, start, extend, skip: stop };
}
