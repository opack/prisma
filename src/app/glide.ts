/**
 * Défilement en douceur de la partition, mené image par image plutôt que confié au navigateur :
 * chaque axe a sa propre course (de côté, de haut en bas), qu'on peut relancer vers un nouveau
 * but sans arrêter l'autre, et dont l'avancée suit l'horloge ou la musique (la page qui descend
 * au rythme de la dernière mesure). Un geste à la main l'interrompt.
 */
import { follow } from "./follow.ts";

/** La part faite d'une course, de 0 à 1. */
export type Progress = () => number;
type Axis = "left" | "top";
type Run = { from: number; to: number; progress: Progress };

/** Une course qui dure ms, depuis maintenant. */
export const timed = (ms: number): Progress => {
  const t0 = performance.now();
  return () => Math.min(1, (performance.now() - t0) / ms);
};

/** Lente au départ et à l'arrivée : la page ne démarre ni ne s'arrête d'un coup. */
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

class Glide {
  private runs: Partial<Record<Axis, Run>> = {};
  private frame = 0;
  private snap = "";
  private pane: HTMLElement;
  constructor(pane: HTMLElement) {
    this.pane = pane;
  }

  /** Mène l'axe vers value ; un but presque atteint ou déjà visé ne relance rien. */
  to(axis: Axis, value: number, progress: Progress = timed(400)) {
    const max = axis === "left" ? this.pane.scrollWidth - this.pane.clientWidth : this.pane.scrollHeight - this.pane.clientHeight;
    value = Math.max(0, Math.min(max, value));
    const now = this.at(axis);
    const run = this.runs[axis];
    if (Math.abs((run ? run.to : now) - value) < 1) return;
    this.runs[axis] = { from: now, to: value, progress };
    if (!this.frame) this.start();
  }

  /** La course vers ce but est-elle en cours ? */
  heading(axis: Axis) {
    return this.runs[axis]?.to;
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.runs = {};
    this.pane.style.scrollSnapType = this.snap;
  }

  private at = (axis: Axis) => (axis === "left" ? this.pane.scrollLeft : this.pane.scrollTop);

  private start() {
    // l'accrochage aux pages ramènerait chaque image au début d'une page : suspendu le temps de la course
    this.snap = this.pane.style.scrollSnapType;
    this.pane.style.scrollSnapType = "none";
    const step = () => {
      if (!follow.active()) return this.stop();
      const pos: ScrollToOptions = { behavior: "instant" };
      for (const axis of ["left", "top"] as Axis[]) {
        const run = this.runs[axis];
        if (!run) continue;
        const p = Math.max(0, Math.min(1, run.progress()));
        pos[axis] = run.from + (run.to - run.from) * ease(p);
        if (p >= 1) delete this.runs[axis];
      }
      this.pane.scrollTo(pos);
      if (this.runs.left || this.runs.top) this.frame = requestAnimationFrame(step);
      else this.stop();
    };
    this.frame = requestAnimationFrame(step);
  }
}

const glides = new WeakMap<HTMLElement, Glide>();

/** La course de défilement d'un panneau. */
export function glide(pane: HTMLElement): Glide {
  let g = glides.get(pane);
  if (!g) glides.set(pane, (g = new Glide(pane)));
  return g;
}
