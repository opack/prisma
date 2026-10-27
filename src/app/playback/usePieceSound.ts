/**
 * L'écoute du morceau gravé : le morceau chargé dans le lecteur (arrêté quand on regrave), et ses
 * réglages, propres au morceau : les portées muettes, l'instrument de chaque partie (deviné d'après
 * son nom, ou choisi), son volume, et le métronome des options. Un nouveau tempo écrit dans la
 * partition reprend la main sur le tempo choisi ; de nouvelles parties effacent les portées muettes,
 * les instruments et les volumes choisis.
 */
import { useEffect, useMemo, useRef } from "react";
import type { Score } from "../../core/index.ts";
import type { RenderOptions } from "../options/options.ts";
import type { PieceSettings } from "../options/piece.ts";
import { instrumentsOf, scoreInstrument, staffInstruments } from "./instruments.ts";
import { player } from "./player.ts";

export function usePieceSound(score: Score | undefined, piece: PieceSettings, updatePiece: (patch: Partial<PieceSettings>) => void, pieceId: number, options: RenderOptions) {
  useEffect(() => player.load(score), [score]);
  const muted = piece.muted ?? [];
  const setMuted = (staves: number[]) => updatePiece({ muted: staves.length ? staves : undefined });
  const parts = useMemo(() => score?.parts ?? [], [score]);
  const instruments = useMemo(() => instrumentsOf(parts, piece.instruments), [parts, piece.instruments]);
  const setInstrument = (part: number, instrument: string) => {
    const chosen = parts.map((_, i) => piece.instruments?.[i] ?? null);
    // l'instrument de la partition n'est pas un choix : il n'est pas retenu
    chosen[part] = parts[part] && instrument === scoreInstrument(parts[part]) ? null : instrument;
    updatePiece({ instruments: chosen.some((t) => t !== null) ? chosen : undefined });
  };
  useEffect(() => void player.setInstruments(staffInstruments(parts, instruments)), [parts, instruments]);
  // un volume par partie, 0 tel quel
  const volumes = useMemo(() => parts.map((_, i) => piece.volumes?.[i] ?? 0), [parts, piece.volumes]);
  const setVolume = (part: number, db: number) => {
    const next = volumes.map((v, i) => (i === part ? db : v));
    updatePiece({ volumes: next.some((v) => v !== 0) ? next : undefined });
  };
  const gains = useMemo(() => parts.flatMap((p, i) => Array.from({ length: p.staves }, () => volumes[i])), [parts, volumes]);

  const partsKey = JSON.stringify(score?.parts ?? []);
  const written = score?.meta.bpm;
  const seen = useRef({ pieceId, partsKey, written });
  useEffect(() => {
    // une partition illisible (une erreur à corriger) ne change rien : on compare à la dernière lue
    if (!score && seen.current.pieceId === pieceId) return;
    const before = seen.current;
    seen.current = { pieceId, partsKey, written };
    if (before.pieceId !== pieceId) return; // un autre morceau : ses réglages viennent d'être lus
    if (before.partsKey !== partsKey && (piece.muted || piece.instruments || piece.volumes)) updatePiece({ muted: undefined, instruments: undefined, volumes: undefined });
    if (before.written !== written && piece.tempo !== undefined) updatePiece({ tempo: undefined });
  }, [pieceId, partsKey, written]);

  useEffect(
    () => player.setSound({ metronome: options.metronome, muted, gains, clickSounds: options.clickSounds, clickGrid: options.clickGrid, countIn: options.countIn, clickVolume: options.clickVolume }),
    [options.metronome, muted, gains, options.clickSounds, options.clickGrid, options.countIn, options.clickVolume],
  );
  return { muted, setMuted, instruments, setInstrument, volumes, setVolume };
}
