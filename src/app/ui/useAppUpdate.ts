/**
 * L'application installée, et qui marche sans réseau : le service worker, enregistré une fois.
 * Prête hors ligne, elle le dit ; une nouvelle version téléchargée attend qu'on la prenne (un
 * morceau en cours ne se recharge pas tout seul) : `waiting`, puis `apply` recharge.
 */
import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function useAppUpdate(notify: (message: string) => void) {
  const [waiting, setWaiting] = useState(false);
  const update = useRef<(reload?: boolean) => Promise<void>>(undefined);
  useEffect(() => {
    update.current = registerSW({
      onNeedRefresh: () => setWaiting(true),
      onOfflineReady: () => notify("Prisma marche désormais sans réseau"),
    });
  }, []);
  return { waiting, apply: () => void update.current?.(true) };
}
