/**
 * Le QR code du morceau : sur la première page (l'option « QR code »), et dans la fenêtre Fichier ›
 * Partager par un QR code…, d'où l'on télécharge son image. Il porte le lien de partage, tenu prêt
 * par useShare : il suit le morceau. Le module qui le dessine ne se charge qu'à la première demande.
 */
import { computed, ref, shallowRef, watch } from "vue";
import type { Ref } from "vue";
import { download } from "./files.ts";
import type { QrCode } from "./qrCode.ts";
import type { Prepared } from "./useShare.ts";

type Deps = {
  prepared: Ref<Prepared | null>;
  /** L'option « QR code » : le QR code sur la première page. */
  onPage: Ref<boolean>;
  notify: (message: string) => void;
};

export const TOO_LONG = "Le morceau est trop long pour un QR code : envoyez plutôt le fichier";

export function useQrCode({ prepared, onPage, notify }: Deps) {
  /** La fenêtre Partager par un QR code… ouverte. */
  const showing = ref(false);
  /** Le QR code du lien : undefined tant qu'il n'est ni prêt ni demandé, null si le morceau est trop long. */
  const code = shallowRef<QrCode | null | undefined>(undefined);

  const wanted = computed(() => (onPage.value || showing.value ? prepared.value?.url : undefined));
  watch(
    wanted,
    async (url, _, onCleanup) => {
      let live = true;
      onCleanup(() => (live = false));
      if (!url) {
        code.value = undefined;
        return;
      }
      const { qrCode } = await import("./qrCode.ts");
      if (live) code.value = qrCode(url);
    },
    { immediate: true },
  );

  // sur la page, un morceau devenu trop long : la page s'en passe, la barre le dit une fois
  watch(code, (now, before) => {
    if (now === null && before !== null && onPage.value) notify(TOO_LONG);
  });

  async function downloadImage() {
    if (!prepared.value) return;
    const { name, url } = prepared.value;
    const fileName = `${name.replace(/\.prisma$/i, "")} (QR).png`;
    try {
      const { qrImage } = await import("./qrCode.ts");
      download(fileName, await qrImage(url));
      notify(`Image téléchargée sous le nom ${fileName}`);
    } catch (error) {
      notify(`Image impossible : ${(error as Error).message}`);
    }
  }

  return { code, showing, downloadImage };
}
