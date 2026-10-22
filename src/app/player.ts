/**
 * Écoute : joue le morceau avec des instruments échantillonnés (bibliothèque smplr : le piano
 * « Splendid Grand Piano », les autres instruments en sons General MIDI), chacun chargé la première
 * fois qu'il sert puis gardé par le navigateur, et publie l'instant joué pour le curseur de la
 * gravure. Chaque portée sonne avec l'instrument de sa partie.
 *
 * Les notes telles qu'écrites, toutes les portées ensemble, au tempo choisi (celui du morceau par
 * défaut), reprises et ordre des sections déroulés, nuances et soufflets en intensité, pédale de résonance,
 * petites notes, trilles, arpèges, points d'orgue, articulations ; un métronome sur les temps, avec
 * ou sans les instruments ; des portées muettes, pour les jouer soi-même.
 */
import { PIANO, boostOf, instrumentLabel, soundOf } from "./instruments.ts";
import { TICKS_PER_BEAT } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { clicks, countIn, entryAt, entryStart, holds, inFirstBar, nextTick, passages, playedLength, playedNotes, playedTick, scoreTick, stretched, unstretched } from "./performance.ts";
import type { Click, ClickGrid, Hold, PlayedNote, Passage } from "./performance.ts";
import { DEFAULT_CLICK_SOUNDS, click, clickVolume, loadClick } from "./metronome.ts";
import type { ClickSounds } from "./metronome.ts";

/** Tempo d'un morceau qui n'en indique pas. */
export const DEFAULT_BPM = 80;
/** Délai entre le clic et la première note, le temps de programmer le début. */
const LEAD_IN = 0.15;
/** Les notes sont programmées un peu à l'avance, par tranches. */
const LOOKAHEAD = 0.4;
const TICK_INTERVAL = 60;
/** Durée, au-delà de sa fin, pendant laquelle une note peut encore sonner (son extinction). */
const RELEASE = 1;
/** Deux clics sur « précédent » à moins de ce délai (ms) : la section d'avant, pas le début de celle-ci. */
const PREVIOUS_AGAIN = 800;
/** Laisser sonner la dernière note avant de s'arrêter. */
const TAIL = 1.5;

/** Une note à jouer, en secondes depuis le départ de l'écoute. */
export type PlayNote = { time: number; midi: number; duration: number; velocity: number; staff: number };

/** Durée d'un tick, en secondes, au tempo donné. */
export const secondsPerTick = (bpm: number) => 60 / bpm / TICKS_PER_BEAT;

/** Durée d'une petite note : brève, sans dépasser le sixième d'un temps aux tempos rapides. */
const GRACE = 0.07;
/** Une petite note peut commencer avant le départ de l'écoute, pendant le délai du début. */
const EARLIEST = -LEAD_IN;

/** Écart entre deux notes d'un arpège, sans que l'accord égrené dépasse la moitié d'un temps. */
const ROLL = 0.04;
/** Durée d'une note de trille : une douzaine de notes par seconde, sans dépasser le quart d'un temps. */
const TRILL = 0.08;

/**
 * Les notes à jouer à partir de l'instant joué `from` (en ticks, reprises comprises), dans l'ordre
 * où elles commencent : celles qui sonnent encore à cet instant sont rejouées dès le départ, pour ce
 * qui leur reste. Les petites notes se jouent juste avant leur note ; une trille alterne la note et
 * sa voisine, en commençant et en finissant par la note, qui sonne ensuite jusqu'au bout ; un arpège
 * égrène son accord à partir du temps.
 */
export function playNotes(notes: PlayedNote[], bpm: number, from = 0, hs: Hold[] = []): PlayNote[] {
  const sec = secondsPerTick(bpm);
  // en secondes depuis le départ, points d'orgue compris
  const zero = stretched(hs, from);
  const at = (played: number) => (stretched(hs, played) - zero) * sec;
  const grace = Math.min(GRACE, 60 / bpm / 6);
  const out: PlayNote[] = [];
  for (const n of notes) {
    if (n.grace) {
      if (n.start >= from) out.push({ time: Math.max(EARLIEST, at(n.start) - n.grace * grace), midi: n.midi, duration: grace, velocity: n.velocity, staff: n.staff });
      continue;
    }
    if (n.end <= from) continue;
    const begin = Math.max(n.start, from);
    // une note d'arpège part un peu après la précédente, et reste tenue (sauf reprise en cours d'accord)
    const rolled = n.roll && n.start >= from ? n.roll.rank * Math.min(ROLL, 60 / bpm / 2 / n.roll.count) : 0;
    const time = at(begin) + rolled, end = at(n.end);
    const trill = n.trill && n.trill.until > begin ? n.trill : undefined;
    if (!trill) {
      out.push({ time, midi: n.midi, duration: end - time, velocity: n.velocity, staff: n.staff });
      continue;
    }
    // un nombre impair de notes égales : la note, la voisine, la note… et la dernière est la note
    const span = at(trill.until) - at(begin);
    const count = Math.max(3, 2 * Math.round(span / Math.min(TRILL, 60 / bpm / 4) / 2) + 1);
    const step = span / count;
    for (let k = 0; k < count; k++) {
      const last = k === count - 1;
      out.push({ time: time + k * step, midi: k % 2 ? trill.midi : n.midi, duration: last ? end - time - k * step : step, velocity: n.velocity, staff: n.staff });
    }
  }
  return out.sort((a, b) => a.time - b.time || a.midi - b.midi);
}

export type PlayerState = "idle" | "loading" | "playing" | "paused";
export type PlayerSnapshot = {
  state: PlayerState;
  /** Instant du morceau joué, en ticks, pour le curseur (null à l'arrêt). */
  tick: number | null;
  /** Rang, dans l'ordre de jeu, de la section jouée : le passage en cours d'une section jouée plusieurs fois. */
  entry: number | null;
  /** Nombre de sections dans l'ordre de jeu du morceau chargé (1 sans sections, 0 sans morceau). */
  entries: number;
  error?: string;
};

/** Ce que l'on entend : le métronome et ses réglages, et les portées rendues muettes (leurs numéros). */
/** Ce qu'on entend : le métronome, les portées muettes, le volume de chaque portée (en décibels), les clics. */
type Sound = { metronome: boolean; muted: number[]; gains: number[]; clickSounds: ClickSounds; clickGrid: ClickGrid; countIn: boolean; clickVolume: number };

/** Un instrument chargé : il joue une note et rend de quoi l'arrêter. */
type Voice = { start(n: { note: number; velocity: number; time: number; duration: number }): () => void };

/** Lecteur unique de l'application : un état, et des abonnés (les boutons, le curseur). */
class Player {
  private snapshot: PlayerSnapshot = { state: "idle", tick: null, entry: null, entries: 0 };
  private listeners = new Set<() => void>();
  private context?: AudioContext;
  /** Les instruments chargés, par nom. */
  private voicesBy = new Map<string, Voice>();
  /** L'instrument de chaque portée. */
  private instruments: string[] = [];
  private timer?: number;
  private frame?: number;
  private run = 0; // numéro de la lecture en cours : une lecture interrompue ne reprend pas la main
  private score?: Score;
  /** Le déroulé du morceau et ses notes, en instants joués. */
  private passages: Passage[] = [];
  private notes: PlayedNote[] = [];
  private holds: Hold[] = [];
  private clicks: Click[] = [];
  private tick?: AudioBuffer;
  /** Ce que l'on entend : le métronome, les portées (sauf les muettes), le son de chaque niveau du métronome. */
  private sound: Sound = { metronome: false, muted: [], gains: [], clickSounds: DEFAULT_CLICK_SOUNDS, clickGrid: "cells", countIn: false, clickVolume: 1 };
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
    this.holds = score ? holds(score, this.passages) : [];
    this.clicks = score ? clicks(score, this.passages, this.sound.clickGrid) : [];
    this.set({ entries: this.passages.length ? this.passages[this.passages.length - 1].entry + 1 : 0 });
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
      const missing = this.missing();
      if (missing.length) this.set({ state: "loading", tick: null, entry: null, error: undefined });
      await this.loadInstruments(missing);
      this.tick = await loadClick(this.context);
      clickVolume(this.context, this.sound.clickVolume);
    } catch (e) {
      if (run === this.run) this.set({ state: "idle", tick: null, entry: null, error: (e as Error).message });
      return;
    }
    if (run !== this.run) return; // arrêté pendant le chargement
    this.start(from, this.sound.countIn);
  }

  /** Les instruments dont le morceau a besoin et qui ne sont pas encore chargés. */
  private missing() {
    const needed = new Set(this.instruments.length ? this.instruments : [PIANO]);
    return [...needed].filter((t) => !this.voicesBy.has(t));
  }

  /** Charge des instruments (la bibliothèque n'est téléchargée qu'à la première écoute). */
  private async loadInstruments(ids: string[]) {
    if (!ids.length) return;
    const { SplendidGrandPiano, Soundfont } = await import("smplr");
    await Promise.all(
      ids.map(async (id) => {
        try {
          // un son General MIDI, remonté au niveau du piano : le gain que smplr lui ajoute déjà (5), plus celui de l'instrument
          const extraGain = 5 * 10 ** (boostOf(id) / 20);
          const voice = id === PIANO ? await SplendidGrandPiano(this.context!).load : await Soundfont(this.context!, { instrument: soundOf(id), extraGain }).load;
          this.voicesBy.set(id, voice as Voice);
        } catch {
          throw new Error(`Impossible de charger le son ${id === PIANO ? "du piano" : `« ${instrumentLabel(id)} »`} (connexion internet ?)`);
        }
      }),
    );
  }

  /**
   * L'instrument de chaque portée ; en cours de lecture, un instrument pas encore chargé se charge, et la
   * suite repart avec lui depuis l'instant joué.
   */
  async setInstruments(instruments: string[]) {
    if (JSON.stringify(instruments) === JSON.stringify(this.instruments)) return;
    this.instruments = instruments;
    if (this.snapshot.state !== "playing") return;
    const run = this.run;
    let error: string | undefined;
    try {
      await this.loadInstruments(this.missing());
    } catch (e) {
      error = (e as Error).message;
    }
    if (run !== this.run || this.snapshot.state !== "playing") return;
    const from = this.now();
    this.halt();
    this.start(from);
    // un instrument introuvable : on le dit, et sa portée se joue au piano
    if (error) this.set({ error });
  }

  /** Métronome, portées muettes et volumes ; en cours de lecture, la suite repart ainsi. */
  setSound(sound: Sound) {
    if (this.context) clickVolume(this.context, sound.clickVolume);
    // le volume s'applique aussitôt, le décompte au prochain départ : rien à reprogrammer
    const heard = (s: Sound) => JSON.stringify([s.metronome, s.muted, s.gains, s.clickSounds, s.clickGrid]);
    const restart = heard(sound) !== heard(this.sound);
    if (sound.clickGrid !== this.sound.clickGrid && this.score) this.clicks = clicks(this.score, this.passages, sound.clickGrid);
    this.sound = sound;
    if (!restart || this.snapshot.state !== "playing") return;
    const from = this.now();
    this.halt();
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

  /** Revient au tout début du morceau. */
  rewind() {
    if (this.snapshot.state !== "loading") this.go(0);
  }

  private previousAt = 0;
  private previousTo = 0;

  /**
   * Revient au début de la section jouée ; si l'on est encore dans sa première mesure, ou au second
   * clic rapproché, au début de la précédente.
   */
  previous() {
    if (this.snapshot.state === "loading") return;
    const now = performance.now();
    const state = this.snapshot.state;
    const pos = state === "playing" ? this.now() : state === "paused" ? this.pos : 0;
    const entry = this.snapshot.entry ?? 0;
    const back = now - this.previousAt < PREVIOUS_AGAIN ? this.previousTo : this.score && inFirstBar(this.score, this.passages, pos) ? entry : entry + 1;
    const to = Math.max(0, back - 1);
    this.previousAt = now;
    this.previousTo = to;
    this.seekEntry(to);
  }

  /** Va au début de la section suivante dans l'ordre de jeu. */
  next() {
    const to = (this.snapshot.entry ?? 0) + 1;
    if (this.snapshot.state !== "loading" && to < this.snapshot.entries) this.seekEntry(to);
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
    // l'horloge audio au moment du clic : une note déjà portée ne peut plus être retenue, elle
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

  /** L'instant du morceau en ce moment même, selon l'horloge audio (le curseur, lui, avance par cases). */
  position(): number | null {
    return this.snapshot.state === "playing" ? scoreTick(this.passages, this.now()) : this.snapshot.tick;
  }

  /** L'instant du morceau qu'on jouera après until (la fin du système joué) : où regarder ensuite. */
  upcoming(until: number): number | null {
    const { state } = this.snapshot;
    if (state !== "playing" && state !== "paused") return null;
    return nextTick(this.passages, state === "playing" ? this.now() : this.pos, until);
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

  /** Joue depuis l'instant joué `from`, après le décompte s'il est demandé (au départ seulement). */
  private start(from: number, counted = false) {
    const run = this.run;
    const context = this.context!;
    // chaque portée avec l'instrument de sa partie ; un instrument qui n'a pas pu se charger : le piano
    const fallback = this.voicesBy.get(PIANO);
    const voiceOf = (staff: number) => this.voicesBy.get(this.instruments[staff] ?? PIANO) ?? fallback;
    // le volume d'une portée joue sur l'intensité des notes (le son va comme son carré), dans les bornes MIDI
    const factor = this.sound.gains.map((db) => 10 ** (db / 40));
    const velocityOf = (n: PlayNote) => (factor[n.staff] ? Math.max(1, Math.min(127, Math.round(n.velocity * factor[n.staff]))) : n.velocity);
    const hs = this.holds;
    // une portée muette n'est pas jouée : on la joue soi-même pendant que l'app joue les autres
    const muted = new Set(this.sound.muted);
    const notes = playNotes(muted.size ? this.notes.filter((n) => !muted.has(n.staff)) : this.notes, this.bpm, from, hs);
    const sec = secondsPerTick(this.bpm);
    const zero = stretched(hs, from);
    const length = (stretched(hs, playedLength(this.passages)) - zero) * sec;
    // l'instant joué après `elapsed` secondes : pendant un point d'orgue, il avance deux fois moins vite
    const played = (elapsed: number) => unstretched(hs, zero + Math.max(0, elapsed) / sec);
    // le décompte : des temps au tempo de l'écoute, puis la musique ; un niveau sans son prend celui du bois
    const count = counted && this.score ? countIn(this.score, this.passages, from) : [];
    const beatSec = TICKS_PER_BEAT * sec;
    const start = context.currentTime + LEAD_IN + count.length * beatSec;
    count.forEach((level, k) => {
      const chosen = this.sound.clickSounds[level];
      const at = context.currentTime + LEAD_IN + k * beatSec;
      this.voices.push({ end: at + 0.1, stop: click(context, this.tick!, at, level, chosen === "none" ? (level === "downbeat" ? "high" : "wood") : chosen) });
    });
    this.now = () => played(context.currentTime - start);
    const sounds = this.sound.clickSounds;
    const beats = this.sound.metronome
      ? this.clicks.flatMap((c) => {
          const sound = sounds[c.level];
          return c.at >= from && sound !== "none" ? [{ time: (stretched(hs, c.at) - zero) * sec, level: c.level, sound }] : [];
        })
      : [];
    let next = 0, nextBeat = 0;
    // programmation par tranches : interrompre coupe aussi ce qui n'a pas encore été programmé
    const schedule = () => {
      const now = context.currentTime;
      this.voices = this.voices.filter((v) => v.end > now);
      for (; next < notes.length && notes[next].time < now - start + LOOKAHEAD; next++) {
        const n = notes[next];
        const voice = voiceOf(n.staff);
        if (!voice) continue;
        const stop = voice.start({ note: n.midi, velocity: velocityOf(n), time: start + n.time, duration: n.duration });
        this.voices.push({ end: start + n.time + n.duration + RELEASE, stop });
      }
      for (; nextBeat < beats.length && beats[nextBeat].time < now - start + LOOKAHEAD; nextBeat++) {
        const b = beats[nextBeat];
        this.voices.push({ end: start + b.time + 0.1, stop: click(context, this.tick!, start + b.time, b.level, b.sound) });
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, TICK_INTERVAL);
    this.set({ state: "playing", ...this.at(from), error: undefined });
    const follow = () => {
      if (run !== this.run) return;
      const elapsed = context.currentTime - start;
      if (elapsed > length + TAIL) return this.stop();
      this.set(elapsed < length ? this.at(played(elapsed)) : { tick: null, entry: null });
      this.frame = requestAnimationFrame(follow);
    };
    this.frame = requestAnimationFrame(follow);
  }
}

export const player = new Player();
