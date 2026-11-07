/**
 * Les réglages du morceau enregistrés à côté de lui, peu après le dernier changement ; il faut son
 * dossier et le morceau lui-même sur le disque (un MusicXML importé : à son premier enregistrement en .prisma).
 */
import { watchDebounced } from "@vueuse/core";
import type { Ref } from "vue";
import type { StoredFile } from "../../app/files/stored.ts";
import { saveSettings } from "../../app/options/piece.ts";
import { useSettings } from "./settings.ts";

export function useSettingsAutosave(handle: Ref<StoredFile | null>, onError: (message: string) => void) {
  const settings = useSettings();
  watchDebounced(
    () => [settings.piece, settings.pieceDir, handle.value] as const,
    ([piece, dir, file]) => {
      if (!settings.changed || !dir || !file) return;
      settings.changed = false;
      saveSettings(dir, file.name, piece).catch((error) => onError(`Réglages du morceau non enregistrés : ${(error as Error).message}`));
    },
    { debounce: 400 },
  );
}
