import { computed, onMounted, watch } from "vue";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

/** The head script runs the same logic before first paint, so there is no flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}");var d=c==="dark"||((c===null||c==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function resolveDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && systemDark);
}

// Defaults to the device's setting; an explicit choice is remembered on this
// device only.
export function useTheme() {
  const choice = useState<ThemeChoice>("theme-choice", () => "system");

  function apply() {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", resolveDark(choice.value, systemDark));
  }

  function set(next: ThemeChoice) {
    choice.value = next;
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice still applies for this visit.
    }
  }

  onMounted(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") choice.value = saved;
    } catch {
      // Fall through to the device setting.
    }
    apply();
    // While following the device, follow it live too.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (choice.value === "system") apply();
    });
  });

  watch(choice, () => {
    if (import.meta.client) apply();
  });

  return { choice: computed(() => choice.value), set };
}
