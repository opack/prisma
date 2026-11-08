/**
 * La source de la bibliothèque et ce qu'on en sait : à choisir (aucune), à autoriser (verrouillée),
 * en lecture, lue (ses morceaux), ou illisible. Un dossier de l'ordinateur ou pCloud ; celle choisie
 * la dernière fois se relit à l'ouverture.
 */
import { shallowRef } from "vue";
import { pickFolder } from "./diskLibrary.ts";
import { scan } from "./library.ts";
import type { LibraryEntry, LibrarySource } from "./library.ts";
import { PcloudAuthError, connect, disconnect } from "./pcloud.ts";
import { available, choose, savedSource } from "./sources.ts";

export type LibraryState =
  | { kind: "unsupported" }
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "locked"; source: LibrarySource; reason?: string }
  | { kind: "ready"; source: LibrarySource; entries: LibraryEntry[] }
  | { kind: "error"; message: string };

export function useLibrarySource() {
  const state = shallowRef<LibraryState>(available.disk || available.pcloud ? { kind: "loading" } : { kind: "unsupported" });

  /** Lit la source ; ask : demander l'accès s'il manque (après un clic seulement). */
  async function load(source: LibrarySource, ask = false) {
    try {
      if (!(await source.access(ask))) return void (state.value = { kind: "locked", source });
      state.value = { kind: "loading" };
      state.value = { kind: "ready", source, entries: await scan(source) };
    } catch (error) {
      // la connexion à pCloud ne vaut plus : la redonner
      if (error instanceof PcloudAuthError) return void (state.value = { kind: "locked", source, reason: error.message });
      state.value = { kind: "error", message: (error as Error).message };
    }
  }
  if (available.disk || available.pcloud) savedSource().then((source) => (source ? load(source) : (state.value = { kind: "none" })));

  return {
    state,
    load,
    /** Retour au choix d'une bibliothèque. */
    change: () => (state.value = { kind: "none" }),
    async chooseFolder() {
      try {
        const source = await pickFolder();
        if (!source) return;
        choose("disk");
        await load(source, true);
      } catch (error) {
        state.value = { kind: "error", message: (error as Error).message };
      }
    },
    choosePcloud() {
      choose("pcloud");
      connect();
    },
    leavePcloud() {
      disconnect();
      choose(null);
      state.value = { kind: "none" };
    },
  };
}
