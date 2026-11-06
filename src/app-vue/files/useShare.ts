/**
 * Partager le morceau ouvert par un lien, et recevoir celui d'un lien. Partager : sur un écran
 * tactile (une tablette, un téléphone), la feuille de partage du système (Messages, mail…) ;
 * ailleurs, le lien copié, à coller dans un message. Recevoir : un lien ouvert, ou collé (Fichier ›
 * Importer un lien), montre le morceau reçu, à ouvrir tel quel ou à enregistrer d'abord dans la
 * bibliothèque.
 */
import { useEventListener } from "@vueuse/core";
import { ref, shallowRef, watch } from "vue";
import type { Ref } from "vue";
import { parseFrontmatter } from "../../core/index.ts";
import { LONG_LINK, decodeShare, encodeShare, shareLink, shareName, sharedIn, sharedInLink } from "../../app/files/share.ts";
import type { Shared } from "../../app/files/share.ts";
import type { StoredFolder } from "../../app/files/stored.ts";
import type { LibrarySource } from "../../app/library/library.ts";
import { savedSource } from "../../app/library/sources.ts";
import type { PieceSettings } from "../../app/options/piece.ts";

type Deps = {
  source: Ref<string>;
  fileName: Ref<string>;
  piece: Ref<PieceSettings>;
  notify: (message: string) => void;
  openShared: (shared: Shared, into?: StoredFolder) => Promise<boolean>;
};

type Prepared = { name: string; url: string };

/** Le lien qui partage le morceau, et le nom sous lequel il part. */
async function link(source: string, fileName: string, piece: PieceSettings): Promise<Prepared> {
  let title: string | undefined;
  try {
    title = parseFrontmatter(source.split(/\r?\n/)).meta.title;
  } catch {
    /* un en-tête illisible : le nom du fichier */
  }
  const name = shareName(fileName, title);
  return { name, url: shareLink(await encodeShare({ name, text: source, settings: piece }), location.origin + location.pathname) };
}

const touch = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function useShare({ source, fileName, piece, notify, openShared }: Deps) {
  /** Le morceau reçu, en attente d'être ouvert ; et la bibliothèque où l'enregistrer, s'il y en a une. */
  const received = shallowRef<Shared | null>(null);
  const library = shallowRef<LibrarySource | null>(null);
  const show = (shared: Shared) => {
    received.value = shared;
    savedSource().then((found) => (library.value = found));
  };

  // un lien ouvert (l'application lancée par lui, ou déjà ouverte dans l'onglet) : son morceau, puis
  // l'adresse sans lui (recharger la page ne le reçoit pas une seconde fois)
  const receive = () => {
    const data = sharedIn(location.hash);
    if (!data) return;
    history.replaceState(null, "", location.pathname + location.search);
    decodeShare(data).then((shared) => (shared ? show(shared) : notify("Lien de partage illisible : il a peut-être été coupé en route")));
  };
  receive();
  useEventListener(window, "hashchange", receive);

  // le lien, tenu prêt : Safari ne partage et ne copie qu'aussitôt après le geste, sans attente entre les deux
  const ready = shallowRef<Prepared | null>(null);
  watch(
    [source, fileName, piece],
    (_, __, onCleanup) => {
      let live = true;
      const timeout = setTimeout(
        () => link(source.value, fileName.value, piece.value).then((prepared) => live && (ready.value = prepared)),
        300,
      );
      onCleanup(() => {
        live = false;
        clearTimeout(timeout);
      });
    },
    { immediate: true },
  );

  async function share() {
    const { name, url } = ready.value ?? (await link(source.value, fileName.value, piece.value));
    const long = url.length > LONG_LINK ? " (un lien long : s'il arrive coupé, envoyez plutôt le fichier)" : "";
    try {
      if (touch() && navigator.share) {
        await navigator.share({ title: name.replace(/\.prisma$/i, ""), url });
        if (long) notify(`Lien partagé${long}`);
        return;
      }
      await navigator.clipboard.writeText(url);
      notify(`Lien de partage copié : collez-le dans un message${long}`);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return; // la feuille de partage refermée
      notify(`Partage impossible : ${(error as Error).message}`);
    }
  }

  /** Fichier › Importer un lien : son choix ouvert ; le lien collé, reçu, ou ce qui l'empêche. */
  const importing = ref(false);
  async function importLink(pasted: string) {
    const data = sharedInLink(pasted);
    if (!data)
      return "Ce n'est pas le lien d'une partition partagée : il contient « #p= » suivi du morceau, en lettres, chiffres, « - » et « _ ».";
    const shared = await decodeShare(data);
    if (!shared) return "Ce lien ne se lit pas : il a peut-être été coupé en route. Copiez-le de nouveau, en entier.";
    importing.value = false;
    show(shared);
    return null;
  }

  const close = () => (received.value = null);
  /** Le morceau reçu ouvert ; enregistré d'abord dans la bibliothèque (son accès, redemandé s'il le faut). */
  async function accept(save: boolean) {
    if (!received.value) return;
    const into = save ? library.value : null;
    if (into && !(await into.access(true))) return notify("Accès à la bibliothèque refusé");
    if (await openShared(received.value, into?.root)) close();
  }

  return { share, received, library, accept, close, importing, importLink };
}
