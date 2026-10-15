/**
 * Son du métronome : un coup de bloc de bois enregistré (« Metronome.wav » de Druminfected sur
 * freesound.org, licence CC0), raccourci à ses 90 premières millisecondes. Le fichier fait partie
 * de l'application : rien à télécharger. Chaque niveau (premier temps, temps, division,
 * subdivision) prend un son au choix : le même coup, plus ou moins haut, ou aucun.
 */
import tickUrl from "./sounds/metronome.wav?url";
import type { ClickLevel } from "./performance.ts";

/** Les sons au choix : le même coup de bois, joué plus ou moins vite (donc plus ou moins haut). */
export type ClickSound = "higher" | "high" | "wood" | "low" | "none";
/** Du silence au plus aigu : l'ordre d'un curseur. */
export const CLICK_SOUNDS: { value: ClickSound; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "low", label: "Grave" },
  { value: "wood", label: "Bois" },
  { value: "high", label: "Aigu" },
  { value: "higher", label: "Très aigu" },
];
const RATE: Record<Exclude<ClickSound, "none">, number> = { higher: 1.65, high: 1.3, wood: 1, low: 0.75 };

/** Force du coup selon son niveau : les divisions plus discrètes que les temps. */
const GAIN: Record<ClickLevel, number> = { downbeat: 1, beat: 0.7, division: 0.45, subdivision: 0.3 };

/** Le son de chaque niveau. */
export type ClickSounds = Record<ClickLevel, ClickSound>;
export const DEFAULT_CLICK_SOUNDS: ClickSounds = { downbeat: "high", beat: "wood", division: "none", subdivision: "none" };

/** Le son décodé, une fois par contexte audio. */
const cache = new WeakMap<AudioContext, Promise<AudioBuffer>>();

/** Prépare le son du métronome ; à attendre avant de programmer le premier coup. */
export function loadClick(context: AudioContext): Promise<AudioBuffer> {
  let sound = cache.get(context);
  if (!sound) {
    sound = fetch(tickUrl)
      .then((r) => r.arrayBuffer())
      .then((data) => context.decodeAudioData(data));
    cache.set(context, sound);
  }
  return sound;
}

/** Programme un coup à l'instant `time` de l'horloge audio ; renvoie de quoi l'annuler. */
/**
 * Le volume du métronome, à part de celui des instruments : un réglage qui s'applique aussitôt,
 * même aux coups déjà programmés.
 */
const buses = new WeakMap<AudioContext, GainNode>();
export function clickVolume(context: AudioContext, volume?: number): GainNode {
  let bus = buses.get(context);
  if (!bus) {
    bus = context.createGain();
    bus.connect(context.destination);
    buses.set(context, bus);
  }
  if (volume !== undefined) bus.gain.value = volume;
  return bus;
}

export function click(context: AudioContext, buffer: AudioBuffer, time: number, level: ClickLevel, sound: Exclude<ClickSound, "none">): () => void {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = RATE[sound];
  const volume = context.createGain();
  volume.gain.value = GAIN[level];
  source.connect(volume).connect(clickVolume(context));
  source.start(time);
  source.onended = () => volume.disconnect();
  return () => {
    try {
      source.stop();
    } catch {
      /* déjà arrêté */
    }
    volume.disconnect();
  };
}
