/** Un avis dans la barre (« Enregistré dans… », une erreur d'ouverture) : il s'efface de lui-même. */
import { useTimeoutFn } from "@vueuse/core";
import { ref } from "vue";

/** Le temps qu'un avis reste affiché (ms). */
const SHOWN = 3500;

export function useNotice() {
  const notice = ref<string | null>(null);
  const { start } = useTimeoutFn(() => (notice.value = null), SHOWN, { immediate: false });
  const notify = (message: string | null) => {
    notice.value = message;
    if (message) start();
  };
  return { notice, notify };
}
