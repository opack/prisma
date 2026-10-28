/**
 * Partager le morceau ouvert par un lien, et recevoir celui d'un lien. Partager : sur un écran
 * tactile (une tablette, un téléphone), la feuille de partage du système (Messages, mail…) ;
 * ailleurs, le lien copié, à coller dans un message. Recevoir : un lien ouvert, ou collé (Fichier ›
 * Importer un lien), montre le morceau reçu, à ouvrir tel quel ou à enregistrer d'abord dans la
 * bibliothèque.
 */
import { useEffect, useState } from "react";
import { parseFrontmatter } from "../../core/index.ts";
import type { PieceSettings } from "../options/piece.ts";
import { savedFolder } from "../library/diskLibrary.ts";
import type { LibrarySource } from "../library/library.ts";
import { LONG_LINK, decodeShare, encodeShare, shareLink, shareName, sharedIn, sharedInLink } from "./share.ts";
import type { Shared } from "./share.ts";
import type { StoredFolder } from "./stored.ts";

type Deps = {
  source: string;
  fileName: string;
  piece: PieceSettings;
  notify: (message: string) => void;
  openShared: (shared: Shared, into?: StoredFolder) => Promise<boolean>;
};

/** Le lien qui partage le morceau, et le nom sous lequel il part. */
async function link(source: string, fileName: string, piece: PieceSettings) {
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
  const [received, setReceived] = useState<Shared | null>(null);
  const [library, setLibrary] = useState<LibrarySource | null>(null);

  // un lien ouvert (l'application lancée par lui, ou déjà ouverte dans l'onglet) : son morceau, puis
  // l'adresse sans lui (recharger la page ne le reçoit pas une seconde fois)
  useEffect(() => {
    const receive = () => {
      const data = sharedIn(location.hash);
      if (!data) return;
      history.replaceState(null, "", location.pathname + location.search);
      decodeShare(data).then((shared) => {
        if (!shared) return notify("Lien de partage illisible : il a peut-être été coupé en route");
        setReceived(shared);
        savedFolder().then(setLibrary);
      });
    };
    receive();
    addEventListener("hashchange", receive);
    return () => removeEventListener("hashchange", receive);
  }, []);

  // le lien, tenu prêt : Safari ne partage et ne copie qu'aussitôt après le geste, sans attente entre les deux
  const [ready, setReady] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => link(source, fileName, piece).then((l) => live && setReady(l)), 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [source, fileName, piece]);

  const share = async () => {
    const { name, url } = ready ?? (await link(source, fileName, piece));
    const long = url.length > LONG_LINK ? " (un lien long : s'il arrive coupé, envoyez plutôt le fichier)" : "";
    try {
      if (touch() && navigator.share) {
        await navigator.share({ title: name.replace(/\.prisma$/i, ""), url });
        if (long) notify(`Lien partagé${long}`);
        return;
      }
      await navigator.clipboard.writeText(url);
      notify(`Lien de partage copié : collez-le dans un message${long}`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // la feuille de partage refermée
      notify(`Partage impossible : ${(e as Error).message}`);
    }
  };

  /** Fichier › Importer un lien : son choix ouvert ; le lien collé, reçu, ou ce qui l'empêche. */
  const [importing, setImporting] = useState(false);
  const importLink = async (link: string) => {
    const data = sharedInLink(link);
    if (!data) return "Ce n'est pas le lien d'une partition partagée : il contient « #p= » suivi du morceau, en lettres, chiffres, « - » et « _ ».";
    const shared = await decodeShare(data);
    if (!shared) return "Ce lien ne se lit pas : il a peut-être été coupé en route. Copiez-le de nouveau, en entier.";
    setImporting(false);
    setReceived(shared);
    savedFolder().then(setLibrary);
    return null;
  };

  const close = () => setReceived(null);
  /** Le morceau reçu ouvert ; enregistré d'abord dans la bibliothèque (son accès, redemandé s'il le faut). */
  const accept = async (save: boolean) => {
    if (!received) return;
    if (save && library && !(await library.access(true))) return notify("Accès à la bibliothèque refusé");
    if (await openShared(received, save && library ? library.root : undefined)) close();
  };

  return { share, received, library, accept, close, importing, setImporting, importLink };
}
