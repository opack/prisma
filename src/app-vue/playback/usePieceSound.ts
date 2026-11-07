/**
 * L'écoute du morceau gravé : le morceau chargé dans le lecteur (arrêté quand on regrave), et ses
 * réglages, propres au morceau : les portées muettes, l'instrument de chaque partie (deviné d'après
 * son nom, ou choisi), son volume, et le métronome des options. Un nouveau tempo écrit dans la
 * partition reprend la main sur le tempo choisi ; de nouvelles parties effacent les portées muettes,
 * les instruments et les volumes choisis.
 */
import { computed, watch, watchEffect } from "vue";
import type { Ref } from "vue";
import type { Score } from "../../core/index.ts";
import { instrumentsOf, scoreInstrument, staffInstruments } from "../../app/playback/instruments.ts";
import { player } from "../../app/playback/player.ts";
import { useSettings } from "../options/settings.ts";

export function usePieceSound(score: Ref<Score | undefined>) {
  const settings = useSettings();
  watch(score, (loaded) => player.load(loaded), { immediate: true });

  const muted = computed(() => settings.piece.muted ?? []);
  const setMuted = (staves: number[]) => settings.updatePiece({ muted: staves.length ? staves : undefined });

  const parts = computed(() => score.value?.parts ?? []);
  const instruments = computed(() => instrumentsOf(parts.value, settings.piece.instruments));
  function setInstrument(part: number, instrument: string) {
    const chosen = parts.value.map((_, index) => settings.piece.instruments?.[index] ?? null);
    // l'instrument de la partition n'est pas un choix : il n'est pas retenu
    chosen[part] = parts.value[part] && instrument === scoreInstrument(parts.value[part]) ? null : instrument;
    settings.updatePiece({ instruments: chosen.some((text) => text !== null) ? chosen : undefined });
  }
  watchEffect(() => void player.setInstruments(staffInstruments(parts.value, instruments.value)));

  // un volume par partie, 0 tel quel
  const volumes = computed(() => parts.value.map((_, index) => settings.piece.volumes?.[index] ?? 0));
  function setVolume(part: number, decibels: number) {
    const next = volumes.value.map((volume, index) => (index === part ? decibels : volume));
    settings.updatePiece({ volumes: next.some((volume) => volume !== 0) ? next : undefined });
  }
  const gains = computed(() => parts.value.flatMap((part, index) => Array.from({ length: part.staves }, () => volumes.value[index])));

  // de nouvelles parties, un nouveau tempo écrit : les réglages qui n'y correspondent plus s'effacent
  const partsKey = computed(() => JSON.stringify(score.value?.parts ?? []));
  const written = computed(() => score.value?.meta.bpm);
  let seen = { pieceId: settings.pieceId, partsKey: partsKey.value, written: written.value };
  watch([() => settings.pieceId, partsKey, written], ([pieceId, key, bpm]) => {
    // une partition illisible (une erreur à corriger) ne change rien : on compare à la dernière lue
    if (!score.value && seen.pieceId === pieceId) return;
    const before = seen;
    seen = { pieceId, partsKey: key, written: bpm };
    if (before.pieceId !== pieceId) return; // un autre morceau : ses réglages viennent d'être lus
    const { piece } = settings;
    if (before.partsKey !== key && (piece.muted || piece.instruments || piece.volumes))
      settings.updatePiece({ muted: undefined, instruments: undefined, volumes: undefined });
    if (before.written !== bpm && piece.tempo !== undefined) settings.updatePiece({ tempo: undefined });
  });

  watchEffect(() => {
    const { options } = settings;
    player.setSound({
      metronome: options.metronome,
      muted: muted.value,
      gains: gains.value,
      clickSounds: options.clickSounds,
      clickGrid: options.clickGrid,
      countIn: options.countIn,
      clickVolume: options.clickVolume,
    });
  });

  return { muted, setMuted, instruments, setInstrument, volumes, setVolume };
}
