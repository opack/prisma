/**
 * Un bouton de pas (le tempo) : un clic avance d'un petit pas ; un appui long, de grands pas
 * réguliers (une première fois après 500 ms, puis toutes les 330 ms), sans le clic qui le termine.
 * Le menu d'un appui long, sur tablette, ne s'ouvre pas. À poser sur le bouton : v-on="useStep(…)".
 */
import { onScopeDispose } from "vue";

export function useStep(step: (delta: number) => void, small: number, big: number) {
  let timer: number | undefined;
  let held = false;
  const stop = () => window.clearTimeout(timer);
  onScopeDispose(stop);

  function start(event: PointerEvent) {
    if (event.button !== 0) return;
    stop();
    held = false;
    const tick = () => {
      held = true;
      step(big);
      timer = window.setTimeout(tick, 330);
    };
    timer = window.setTimeout(tick, 500);
    // relâché ailleurs, ou sur le bouton devenu inactif (une borne atteinte) : l'appui finit
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  return {
    pointerdown: start,
    contextmenu: (event: MouseEvent) => event.preventDefault(),
    click: () => {
      if (held) held = false;
      else step(small);
    },
  };
}
