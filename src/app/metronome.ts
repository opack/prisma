/**
 * Son du métronome : un coup de bloc de bois enregistré (« Metronome.wav » de Druminfected sur
 * freesound.org, licence CC0), raccourci à ses 90 premières millisecondes. Le fichier fait partie
 * de l'application : rien à télécharger. Le premier temps de la mesure est le même coup, joué
 * plus haut et plus fort.
 */
import tickUrl from "./sounds/metronome.wav?url";

/** Hauteur (vitesse de lecture) et force du coup : premier temps de la mesure, ou autre temps. */
const STRONG = { rate: 1.3, gain: 1 };
const WEAK = { rate: 1, gain: 0.7 };

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
export function click(context: AudioContext, buffer: AudioBuffer, time: number, strong: boolean): () => void {
  const { rate, gain } = strong ? STRONG : WEAK;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const volume = context.createGain();
  volume.gain.value = gain;
  source.connect(volume).connect(context.destination);
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
