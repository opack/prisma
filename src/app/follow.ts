/**
 * Suivi de la lecture : la partition défile avec le curseur. On peut s'y promener à la main
 * (molette, barre de défilement, doigt, touches de page) : le suivi attend, puis reprend une
 * seconde après le dernier geste et ramène au curseur. Le bouton de la barre l'arrête pour de bon,
 * ou le rétablit.
 */
const DELAY = 1000;

let on = true;
let held = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const follow = {
  /** Le suivi voulu (le bouton). */
  enabled: () => on,
  /** Le suivi en ce moment : voulu, et sans promenade en cours. */
  active: () => on && !held,
  set(value: boolean) {
    if (value === on && !held) return;
    on = value;
    this.release();
    notify();
  },
  /** Un geste à la main : le suivi attend une seconde de plus. */
  hold() {
    if (!on) return;
    clearTimeout(timer);
    timer = setTimeout(() => this.release(), DELAY);
    if (!held) (held = true), notify();
  },
  /** La promenade s'arrête : le suivi reprend tout de suite (un clic dans la partition, un saut). */
  release() {
    clearTimeout(timer);
    if (held) (held = false), notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
