import { ref } from "vue";

// Starting a strength session from the plan links the new log to the planned
// session, so finishing it is what completes it.
export function useStartSession(session: () => { id: string; templateId?: string | null }) {
  const starting = ref(false);
  const startError = ref<string | null>(null);

  async function start() {
    starting.value = true;
    startError.value = null;
    try {
      const { id } = await $fetch<{ id: string }>("/api/strength/logs", {
        method: "POST",
        body: { templateId: session().templateId, planSessionId: session().id },
      });
      await navigateTo(`/strength/log/${id}`);
    } catch (e) {
      startError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || "Couldn't start the session.";
    } finally {
      starting.value = false;
    }
  }

  return { starting, startError, start };
}
