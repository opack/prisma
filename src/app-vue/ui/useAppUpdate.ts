/**
 * L'application installée, et qui marche sans réseau : le service worker, enregistré une fois.
 * Prête hors ligne, elle le dit ; une nouvelle version téléchargée attend qu'on la prenne (un
 * morceau en cours ne se recharge pas tout seul) : waiting, puis apply recharge.
 */
import { onMounted, ref } from "vue";
import { registerSW } from "virtual:pwa-register";

export function useAppUpdate(notify: (message: string) => void) {
  const waiting = ref(false);
  let update: ((reload?: boolean) => Promise<void>) | undefined;
  onMounted(() => {
    update = registerSW({
      onNeedRefresh: () => (waiting.value = true),
      onOfflineReady: () => notify("Prisma marche désormais sans réseau"),
    });
  });
  return { waiting, apply: () => void update?.(true) };
}
