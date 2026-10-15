/**
 * Écoute : joue le morceau avec un piano échantillonné (bibliothèque smplr, « Splendid Grand
 * Piano »), chargé au premier clic puis gardé par le navigateur, et publie l'instant joué
 * pour le curseur de la gravure.
 *
 * Les notes telles qu'écrites, toutes les parties ensemble, au tempo choisi (celui du morceau par
 * défaut), reprises et ordre des sections déroulés, nuances et soufflets en intensité, pédale de résonance.
 */
import type { SplendidGrandPiano } from "smplr";
import { TICKS_PER_BEAT } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { entryAt, entryStart, passages, playedLength, playedNotes, playedTick, scoreTick } from "./performance.ts";
import type { PlayedNote, Passage } from "./performance.ts";

/** Tempo d'un morceau qui n'en indique pas. */
export const DEFAULT_BPM = 80;
/** Délai entre le clic et la première note, le temps de programmer le début. */
const LEAD_IN = 0.15;
/** Les notes sont programmées un peu à l'avance, par tranches. */
const LOOKAHEAD = 0.4;
const TICK_INTERVAL = 60;
/** Durée, au-delà de sa fin, pendant laquelle une note peut encore sonner (son extinction). */
const RELEASE = 1;
/** Laisser sonner la dernière note avant de s'arrêter. */
const TAIL = 1.5;

/** Une note à jouer, en secondes depuis le départ de l'écoute. */
export type PlayNote = { time: number; midi: number; duration: number; velocity: number };

/** Durée d'un tick, en secondes, au tempo donné. */
export const secondsPerTick = (bpm: number) => 60 / bpm / TICKS_PER_BEAT;

/**
 * Les notes à jouer à partir de l'instant joué `from` (en ticks, reprises comprises), dans l'ordre
 * où elles commencent : celles qui sonnent encore à cet instant sont rejouées dès le départ, pour ce
 * qui leur reste.
 */
export function playNotes(notes: PlayedNote[], bpm: number, from = 0): PlayNote[] {
  const sec = secondsPerTick(bpm);
  return notes
    .filter((n) => n.end > from)
    .map((n) => ({ time: Math.max(0, n.start - from) * sec, midi: n.midi, duration: (n.end - Math.max(n.start, from)) * sec, velocity: n.velocity }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);
}

export type PlayerState = "idle" | "loading" | "playing" | "paused";
export type PlayerSnapshot = {
  state: PlayerState;
  /** Instant du morceau joué, en ticks, pour le curseur (null à l'arrêt). */
  tick: number | null;
  /** Rang, dans l'ordre de jeu, de la section jouée : le passage en cours d'une section jouée plusieurs fois. */
  entry: number | null;
  error?: string;
};

type Piano = Awaited<ReturnType<typeof SplendidGrandPiano>["load"]>;

/** Lecteur unique de l'application : un état, et des abonnés (les boutons, le curseur). */
class Player {
  private snapshot: PlayerSnapshot = { state: "idle", tick: null, entry: null };
  private listeners = new Set<() => void>();
  private context?: AudioContext;
  private piano?: Piano;
  private timer?: number;
  private frame?: number;
  private run = 0; // numéro de la lecture en cours : une lecture interrompue ne reprend pas la main
  private score?: Score;
  /** Le déroulé du morceau et ses notes, en instants joués. */
  private passages: Passage[] = [];
  private notes: PlayedNote[] = [];
  /** Instant joué de la pause (le curseur, lui, montre l'instant du morceau). */
  private pos = 0;
  private bpm = DEFAULT_BPM;
  /** Notes confiées au piano, à couper à la pause : smplr garde les notes à venir dans sa propre file. */
  private voices: { end: number; stop: () => void }[] = [];
  /** Instant joué selon l'horloge audio, plus juste que le dernier dessin du curseur. */
  private now = () => 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;
  private set(next: Partial<PlayerSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const l of this.listeners) l();
  }

  /** Le morceau à écouter : arrête l'écoute d'un autre et prépare son déroulé. */
  load(score: Score | undefined) {
    if (score === this.score) return;
    this.stop();
    this.score = score;
    this.passages = score ? passages(score) : [];
    this.notes = score ? playedNotes(score, this.passages) : [];
  }

  /** Joue le morceau, depuis l'endroit de la pause s'il y en a une, sinon depuis le début. */
  async play(score: Score, bpm: number) {
    this.load(score);
    const from = this.snapshot.state === "paused" ? this.pos : 0;
    this.halt();
    this.bpm = bpm;
    const run = this.run;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (!this.piano) {
        this.set({ state: "loading", tick: null, entry: null, error: undefined });
        // la bibliothèque n'est téléchargée qu'à la première écoute
        const { SplendidGrandPiano } = await import("smplr");
        this.piano = await SplendidGrandPiano(this.context).load;
      }
    } catch {
      if (run === this.run) this.set({ state: "idle", tick: null, entry: null, error: "Impossible de charger le son du piano (connexion internet ?)" });
      return;
    }
    if (run !== this.run) return; // arrêté pendant le chargement
    this.start(from);
  }

  /** Change le tempo ; en cours de lecture, la suite repart au nouveau tempo depuis l'instant joué. */
  setTempo(bpm: number) {
    if (bpm === this.bpm) return;
    this.bpm = bpm;
    if (this.snapshot.state !== "playing") return;
    const from = this.now();
    this.halt();
    this.start(from);
  }

  /**
   * Place la lecture à l'instant du morceau `tick` : elle y repart si elle est en cours, sinon elle
   * y reprendra. Dans une reprise, c'est le passage en cours qui compte.
   */
  seek(tick: number) {
    if (this.snapshot.state === "loading") return;
    const playing = this.snapshot.state === "playing";
    this.go(playedTick(this.passages, tick, playing ? this.now() : this.snapshot.state === "paused" ? this.pos : 0));
  }

  /** Place la lecture au début de la section de rang `entry` dans l'ordre de jeu (un clic sur sa lettre). */
  seekEntry(entry: number) {
    if (this.snapshot.state !== "loading") this.go(entryStart(this.passages, entry));
  }

  private go(pos: number | null) {
    if (pos === null) return;
    if (this.snapshot.state === "playing") {
      this.halt();
      this.start(pos);
    } else this.pause(pos);
  }

  /** Suspend la lecture, recalée sur la dernière attaque : la reprise rejoue la case surlignée. */
  pause(at?: number) {
    if (at === undefined && this.snapshot.state !== "playing") return;
    // l'horloge audio au moment du clic : une note déjà partie ne peut plus être retenue, elle
    // s'entend ; la pause se cale donc sur elle, même si le curseur n'a pas encore eu le temps d'y passer
    const played = at ?? this.now();
    this.halt();
    this.pos = at ?? this.notes.reduce((t, n) => (n.start <= played && n.start > t ? n.start : t), 0);
    this.set({ state: "paused", ...this.at(this.pos), error: undefined });
  }

  stop() {
    this.halt();
    if (this.snapshot.state !== "idle" || this.snapshot.tick !== null) this.set({ state: "idle", tick: null, entry: null });
  }

  /** Ce que publie un instant joué : la case du morceau et la section de l'ordre de jeu. */
  private at(played: number) {
    return { tick: scoreTick(this.passages, played), entry: entryAt(this.passages, played) };
  }

  /** Coupe le son et la programmation, sans toucher à l'état publié. */
  private halt() {
    this.run++;
    if (this.timer !== undefined) clearInterval(this.timer);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.timer = this.frame = undefined;
    for (const v of this.voices) v.stop();
    this.voices = [];
  }

  private start(from: number) {
    const run = this.run;
    const context = this.context!, piano = this.piano!;
    const notes = playNotes(this.notes, this.bpm, from);
    const sec = secondsPerTick(this.bpm);
    const length = (playedLength(this.passages) - from) * sec;
    const start = context.currentTime + LEAD_IN;
    this.now = () => from + Math.max(0, (context.currentTime - start) / sec);
    let next = 0;
    // programmation par tranches : interrompre coupe aussi ce qui n'a pas encore été programmé
    const schedule = () => {
      const now = context.currentTime;
      this.voices = this.voices.filter((v) => v.end > now);
      for (; next < notes.length && notes[next].time < now - start + LOOKAHEAD; next++) {
        const n = notes[next];
        const stop = piano.start({ note: n.midi, velocity: n.velocity, time: start + n.time, duration: n.duration });
        this.voices.push({ end: start + n.time + n.duration + RELEASE, stop });
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, TICK_INTERVAL);
    this.set({ state: "playing", ...this.at(from), error: undefined });
    const follow = () => {
      if (run !== this.run) return;
      const elapsed = context.currentTime - start;
      if (elapsed > length + TAIL) return this.stop();
      this.set(elapsed < length ? this.at(from + Math.max(0, elapsed / sec)) : { tick: null, entry: null });
      this.frame = requestAnimationFrame(follow);
    };
    this.frame = requestAnimationFrame(follow);
  }
}

export const player = new Player();
