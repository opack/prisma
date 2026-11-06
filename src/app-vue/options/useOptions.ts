/**
 * Les options de la partition, retenues d'une visite à l'autre : lues du stockage, réécrites à chaque
 * changement. Le panneau des options et les réglages propres à un morceau viendront s'y ajouter.
 */
import { ref } from "vue";
import { loadOptions, saveOptions } from "../../app/options/options.ts";
import type { RenderOptions } from "../../app/options/options.ts";

export function useOptions() {
  const options = ref<RenderOptions>(loadOptions());
  function setOptions(patch: Partial<RenderOptions>) {
    options.value = { ...options.value, ...patch };
    saveOptions(options.value);
  }
  return { options, setOptions };
}
