import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { Score } from "../../core/index.ts";
import { DEFAULT_BPM, player } from "./player.ts";
import { follow } from "../score/follow.ts";
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";
import { TEMPO_STEP, stepTempo } from "./tempo.ts";
import { INSTRUMENTS, PIANO, instrumentLabel, scoreInstrument } from "./instruments.ts";
import { MAX_VOLUME, MIN_VOLUME } from "../options/piece.ts";
import { staffNames } from "./staves.ts";
import { Popover } from "../ui/popover/Popover.tsx";
import { PopoverCheck } from "../ui/popover/PopoverCheck.tsx";
import { PopoverChoices } from "../ui/popover/PopoverChoices.tsx";
import { PopoverHint } from "../ui/popover/PopoverHint.tsx";
import { DialogTrigger, Pressable } from "react-aria-components";
import { Button } from "../ui/button/Button.tsx";
import { ButtonGroup } from "../ui/button/ButtonGroup.tsx";

/** La flèche d'un bouton à réglages (le métronome, la musique), qui ouvre son panneau. */
function More() {
  return (
    <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true">
      <path d="M1 6.5h6L4 10z" fill="currentColor" />
    </svg>
  );
}
/** Une ligne de la liste des parties : la partie (ou sa portée), son instrument, son volume. */
const ROW = "flex items-center justify-between gap-2.5";
import { CLICK_GRIDS } from "../options/options.ts";
import type { ClickGrid } from "./performance.ts";

const labels = { idle: "Écouter", loading: "Chargement du piano… (cliquer pour annuler)", playing: "Pause", paused: "Reprendre" };

/** Icône des boutons de lecture, dessinée dans un carré de 16. */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

const MIN_BPM = MIN_TEMPO;
const MAX_BPM = MAX_TEMPO;

/**
 * Commandes d'écoute de la barre : début, section précédente, lecture et pause, section suivante,
 * arrêt ; et le tempo, celui de la partition par défaut, qu'on peut changer (même en cours de
 * lecture) puis rétablir.
 */
type Props = {
  score?: Score;
  disabled: boolean;
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  /** Ce que bat le métronome (l'option « Battre »), et son changement. */
  clickGrid: ClickGrid;
  onClickGrid: (grid: ClickGrid) => void;
  /** Les portées muettes (leurs numéros) : on les joue soi-même pendant que l'app joue les autres. */
  muted: number[];
  onMuted: (staves: number[]) => void;
  /** L'instrument de chaque partie, et son changement. */
  instruments: string[];
  onInstrument: (part: number, instrument: string) => void;
  /** Le volume de chaque partie (en décibels, 0 tel quel), et son changement. */
  volumes: number[];
  onVolume: (part: number, db: number) => void;
  /** Le tempo choisi pour ce morceau, ou null : celui de la partition. */
  tempo: number | null;
  onTempo: (bpm: number | null) => void;
  /**
   * Sa place : dans la barre (bar), tout, ses réglages (le tempo, le suivi, le métronome, la musique)
   * en moins quand la place manque (crowded:) ; sous le bouton ⋯ (more), ses réglages seuls.
   */
  place: "bar" | "more";
};

export function ListenControls({
  score,
  disabled,
  metronome,
  onMetronome,
  clickGrid,
  onClickGrid,
  muted,
  onMuted,
  instruments,
  onInstrument,
  volumes,
  onVolume,
  tempo,
  onTempo,
  place,
}: Props) {
  const { state, error, entry: playing, entries } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const following = useSyncExternalStore(follow.subscribe, follow.enabled);
  const entry = playing ?? 0;
  const written = score?.meta.bpm ?? DEFAULT_BPM;
  const chosen = tempo;
  const setChosen = onTempo;
  const bpm = chosen ?? written;
  useEffect(() => player.setTempo(bpm), [bpm]);

  const toggle = () => {
    if (state === "playing") player.pause();
    else if (state === "loading") player.stop();
    else if (score) {
      follow.release();
      player.play(score, bpm);
    }
  };
  /** Revenir au début, à une section : la partition y retourne sans attendre. */
  const go = (move: () => void) => () => {
    follow.release();
    move();
  };

  const bar = place === "bar";
  // un réglage, dans la barre : il passe sous le bouton ⋯ quand la place manque
  const setting = bar ? "crowded:hidden" : "";
  return (
    <>
      {bar && error && (
        <span className="ml-3 text-accent whitespace-nowrap" role="status">
          {error}
        </span>
      )}
      {bar && <span className="flex-1" />}
      <TempoControl
        className={setting}
        bpm={bpm}
        written={written}
        chosen={chosen !== null}
        onTempo={(picked) => setChosen(picked === written ? null : picked)}
      />
      {bar && (
        <ButtonGroup label="Lecture">
          <Button
            size="icon"
            onClick={go(() => player.rewind())}
            disabled={disabled}
            title="Revenir au début du morceau"
            aria-label="Revenir au début"
          >
            <Icon d="M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z" />
          </Button>
          <Button
            size="icon"
            onClick={go(() => player.previous())}
            disabled={disabled}
            title="Début de la section (deux clics : section précédente)"
            aria-label="Section précédente"
          >
            <Icon d="M3 3h2v10H3zM13 3v10L5 8z" />
          </Button>
          <Button size="icon" onClick={toggle} disabled={disabled} title={labels[state]} aria-label={labels[state]}>
            {state === "loading" ? (
              <span className="leading-[14px]">…</span>
            ) : (
              <Icon d={state === "playing" ? "M4 3h3v10H4zM9 3h3v10H9z" : "M4 2.5v11L13 8z"} />
            )}
          </Button>
          <Button
            size="icon"
            onClick={go(() => player.next())}
            disabled={disabled || entry + 1 >= entries}
            title="Section suivante"
            aria-label="Section suivante"
          >
            <Icon d="M11 3h2v10h-2zM3 3v10l8-5z" />
          </Button>
          <Button
            size="icon"
            onClick={() => player.stop()}
            disabled={state === "idle"}
            title="Arrêter et revenir au début"
            aria-label="Arrêter"
          >
            <Icon d="M3.5 3.5h9v9h-9z" />
          </Button>
        </ButtonGroup>
      )}
      <Button
        size="icon"
        className={setting}
        pressed={following}
        onClick={() => follow.set(!following)}
        title={
          following
            ? "Suivre la lecture : la partition suit le curseur, et y revient une seconde après qu'on l'a fait défiler à la main"
            : "Suivre la lecture : arrêté"
        }
        aria-label="Suivre la lecture"
      >
        <Icon d="M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM8 6.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4zM7.25 .5h1.5v2h-1.5zM7.25 13.5h1.5v2h-1.5zM.5 7.25h2v1.5h-2zM13.5 7.25h2v1.5h-2z" />
      </Button>
      <span className={`${setting} flex`}>
        <MetronomeMenu metronome={metronome} onMetronome={onMetronome} clickGrid={clickGrid} onClickGrid={onClickGrid} />
        <PartsMenu
          score={score}
          muted={muted}
          onMuted={onMuted}
          instruments={instruments}
          onInstrument={onInstrument}
          volumes={volumes}
          onVolume={onVolume}
        />
      </span>
    </>
  );
}

/**
 * Le métronome : un bouton qui l'allume ou le coupe, et sa flèche, qui ouvre le choix de ce qu'il
 * bat (l'option « Battre », la même que dans les options).
 */
type MetronomeProps = {
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  clickGrid: ClickGrid;
  onClickGrid: (grid: ClickGrid) => void;
};

function MetronomeMenu({ metronome, onMetronome, clickGrid, onClickGrid }: MetronomeProps) {
  return (
    <ButtonGroup>
      <Button
        size="icon"
        pressed={metronome}
        onClick={() => onMetronome(!metronome)}
        title={metronome ? "Métronome : marque les temps" : "Métronome : coupé"}
        aria-label="Métronome"
      >
        <Icon d="M6.2 1.5h3.6L13 14.5H3zM7 4.5l-.9 8h3.8l-.9-8zM8 11.8 12.6 3.6l.9.5-4.4 8z" />
      </Button>
      <DialogTrigger>
        <Pressable>
          <Button size="caret" title="Ce que bat le métronome" aria-label="Battre">
            <More />
          </Button>
        </Pressable>
        <Popover label="Battre" title="Battre" className="w-[280px]">
          <PopoverChoices name="click-grid-bar" options={CLICK_GRIDS} value={clickGrid} onChange={onClickGrid} />
        </Popover>
      </DialogTrigger>
    </ButtonGroup>
  );
}

/**
 * Les portées jouées : un bouton qui coupe ou rend la musique d'un clic (le métronome seul reste),
 * et sa flèche, qui ouvre la liste des parties, chacune avec son instrument, et de leurs portées,
 * chacune à cocher pour l'entendre ou la rendre muette (pour la jouer soi-même). La musique
 * rendue retrouve les portées choisies avant.
 */
type PartsProps = {
  score?: Score;
  muted: number[];
  onMuted: (staves: number[]) => void;
  instruments: string[];
  onInstrument: (part: number, instrument: string) => void;
  volumes: number[];
  onVolume: (part: number, db: number) => void;
};

function PartsMenu({ score, muted, onMuted, instruments, onInstrument, volumes, onVolume }: PartsProps) {
  // le dernier choix où une portée au moins jouait : la musique rendue le retrouve
  const before = useRef<number[]>([]);
  const names = score ? staffNames(score.parts) : [];
  // les portées de chaque partie, nommées sans le nom de la partie quand il les précède
  const groups: { name?: string; staves: { k: number; label: string }[] }[] = [];
  let staffIndex = 0;
  for (const part of score?.parts ?? []) {
    const staves = Array.from({ length: part.staves }, () => {
      const full = names[staffIndex];
      const label = part.staves > 1 && full.includes(" — ") ? full.split(" — ")[1] : full;
      return { k: staffIndex++, label: part.staves > 1 ? label[0].toUpperCase() + label.slice(1) : label };
    });
    groups.push({ name: part.name, staves });
  }
  const all = names.map((_, staff) => staff);
  const silent = names.length > 0 && muted.length >= names.length;
  const title = !muted.length
    ? "Musique : toutes les portées jouées"
    : silent
      ? "Musique : coupée (le métronome seul)"
      : `Musique : ${muted.length} portée${muted.length > 1 ? "s" : ""} muette${muted.length > 1 ? "s" : ""} sur ${names.length}`;
  const toggle = (staff: number) =>
    onMuted(muted.includes(staff) ? muted.filter((other) => other !== staff) : [...muted, staff].sort((first, second) => first - second));
  if (!silent) before.current = muted;
  const music = () => onMuted(silent ? before.current : all);
  return (
    <ButtonGroup className="ml-[5px]">
      <Button size="icon" pressed={!silent} onClick={music} disabled={!names.length} title={title} aria-label="Musique">
        <Icon d="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
      </Button>
      <DialogTrigger>
        <Pressable>
          <Button
            size="caret"
            disabled={!names.length}
            title="Portées jouées et instruments des parties"
            aria-label="Parties et instruments"
          >
            <More />
          </Button>
        </Pressable>
        <Popover label="Parties et instruments" title="Parties et instruments" className="w-min min-w-[300px]">
          {groups.map((group, index) => {
            // l'instrument de la partition (écrit après le nom de la partie, ou deviné) ; un autre choix se rétablit d'un clic
            const fromScore = score ? scoreInstrument(score.parts[index]) : PIANO;
            const chosen = (instruments[index] ?? PIANO) !== fromScore;
            const instrument = (
              <span className="inline-flex items-center gap-1">
                <select
                  className="max-w-[11em] px-1 py-0.5 bg-white border border-line rounded"
                  value={instruments[index] ?? PIANO}
                  onChange={(changeEvent) => onInstrument(index, changeEvent.target.value)}
                  aria-label={`Instrument${group.name ? ` : ${group.name}` : ""}`}
                  title={
                    chosen
                      ? `Choisi pour ce morceau ; la partition donne : ${instrumentLabel(fromScore)}`
                      : "L'instrument de la partie, à l'écoute, tel que la partition le donne"
                  }
                >
                  {INSTRUMENTS.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                {chosen && (
                  <Button
                    size="small"
                    onClick={() => onInstrument(index, fromScore)}
                    title={`Reprendre l'instrument de la partition (${instrumentLabel(fromScore)})`}
                    aria-label="Reprendre l'instrument de la partition"
                  >
                    ↺
                  </Button>
                )}
              </span>
            );
            // le volume de la partie : un réglage fin, pour équilibrer les parties (un double-clic le remet à 0)
            const db = volumes[index] ?? 0;
            const volume = (
              <label
                className="inline-flex items-center gap-1 text-muted text-[12px] cursor-pointer whitespace-nowrap"
                title="Le volume de la partie à l'écoute, pour ce morceau (double-clic : tel quel)"
              >
                <input
                  className="w-[72px] accent-accent"
                  type="range"
                  min={MIN_VOLUME}
                  max={MAX_VOLUME}
                  step={1}
                  value={db}
                  onChange={(event) => onVolume(index, Number(event.target.value))}
                  onDoubleClick={() => onVolume(index, 0)}
                  aria-label={`Volume${group.name ? ` : ${group.name}` : ""}`}
                />
                <output className="min-w-[3.6em] text-right tabular-nums">{db > 0 ? `+${db}` : db < 0 ? `−${-db}` : "0"} dB</output>
              </label>
            );
            // une partie d'une portée : une seule ligne ; sinon son nom et son instrument, puis ses portées
            if (group.staves.length === 1)
              return (
                <div key={index} className={ROW}>
                  <PopoverCheck checked={!muted.includes(group.staves[0].k)} onChange={() => toggle(group.staves[0].k)}>
                    {group.staves[0].label}
                  </PopoverCheck>
                  {instrument}
                  {volume}
                </div>
              );
            return (
              <div key={index} className="grid gap-1">
                <div className={ROW}>
                  <span className="font-semibold">{group.name || "Partie"}</span>
                  {instrument}
                  {volume}
                </div>
                {group.staves.map((staff) => (
                  <PopoverCheck key={staff.k} className="pl-3.5" checked={!muted.includes(staff.k)} onChange={() => toggle(staff.k)}>
                    {staff.label}
                  </PopoverCheck>
                ))}
              </div>
            );
          })}
          <ButtonGroup className="mt-1 justify-self-start">
            <Button size="small" onClick={() => onMuted([])} disabled={!muted.length}>
              Toutes
            </Button>
            <Button size="small" onClick={() => onMuted(all)} disabled={silent}>
              Aucune
            </Button>
          </ButtonGroup>
          <PopoverHint>
            Une portée muette n'est pas jouée : à vous de la jouer, avec le métronome au besoin. L'instrument d'une partie est celui que la
            partition écrit après son nom, ou que son nom fait deviner ; un autre choix, comme le volume, vaut pour ce morceau.
          </PopoverHint>
        </Popover>
      </DialogTrigger>
    </ButtonGroup>
  );
}

/**
 * Un bouton de pas (le tempo) : un clic avance d'un petit pas ; un appui long, de grands pas
 * réguliers (une première fois après 500 ms, puis toutes les 330 ms), sans le clic qui le termine.
 * Le menu d'un appui long, sur tablette, ne s'ouvre pas.
 */
function useStep(step: (delta: number) => void, small: number, big: number) {
  const latest = useRef(step);
  latest.current = step;
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const stop = () => window.clearTimeout(timer.current);
  useEffect(() => stop, []);
  const start = (event: PointerEvent) => {
    if (event.button !== 0) return;
    stop();
    held.current = false;
    const tick = () => {
      held.current = true;
      latest.current(big);
      timer.current = window.setTimeout(tick, 330);
    };
    timer.current = window.setTimeout(tick, 500);
    // relâché ailleurs, ou sur le bouton devenu inactif (une borne atteinte) : l'appui finit
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  return {
    onPointerDown: start,
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
    onClick: () => {
      if (held.current) held.current = false;
      else latest.current(small);
    },
  };
}

/**
 * Le tempo de l'écoute, à portée du doigt : − et + de 1 (un appui long : de 5 en 5), et entre eux
 * le champ, pour un tempo précis, avec son ↺ qui revient au tempo de la partition. Quand la place
 * manque dans la barre, il passe sous le bouton ⋯, entier. Sa place (className) dépend de ce qui l'entoure.
 */
type TempoProps = { bpm: number; written: number; chosen: boolean; onTempo: (bpm: number) => void; className?: string };

function TempoControl({ bpm, written, chosen, onTempo, className = "" }: TempoProps) {
  const [draft, setDraft] = useState<string | null>(null); // saisie en cours, pas encore un tempo valable
  const slower = useStep((step) => onTempo(stepTempo(bpm, -step)), 1, TEMPO_STEP);
  const faster = useStep((step) => onTempo(stepTempo(bpm, step)), 1, TEMPO_STEP);
  const edit = (text: string) => {
    setDraft(text);
    const typed = Number(text);
    if (Number.isInteger(typed) && typed >= MIN_BPM && typed <= MAX_BPM) onTempo(typed);
  };
  const hold = `appui long : de ${TEMPO_STEP} en ${TEMPO_STEP}`;
  return (
    <ButtonGroup label="Tempo" className={className}>
      <Button size="icon" {...slower} disabled={bpm <= MIN_BPM} title={`Plus lent, de 1 bpm (${hold})`} aria-label="Plus lent">
        <Icon d="M3 7.25h10v1.5H3z" />
      </Button>
      <span
        className="flex items-center h-[2.1em] touch:h-11 pr-1.5 bg-white border border-line focus-within:relative focus-within:z-1 focus-within:border-muted"
        title={`Tempo de l'écoute, en temps par minute (${MIN_BPM} à ${MAX_BPM})`}
      >
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          value={draft ?? bpm}
          onChange={(changeEvent) => edit(changeEvent.target.value)}
          onBlur={() => setDraft(null)}
          className="w-[2.6em] px-1 py-0 leading-none text-center text-[1.2em] font-semibold tabular-nums bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label="Tempo de l'écoute"
        />
        {chosen && (
          <button
            className="m-0 px-1 py-0 text-[1em] leading-none text-muted bg-none border-0 cursor-pointer hover:text-ink"
            onClick={() => (onTempo(written), setDraft(null))}
            title={`Revenir au tempo de la partition (${written} bpm)`}
            aria-label="Revenir au tempo de la partition"
          >
            ↺
          </button>
        )}
        <span className="ml-0.5 text-muted text-[0.9em] compact:hidden">bpm</span>
      </span>
      <Button size="icon" {...faster} disabled={bpm >= MAX_BPM} title={`Plus rapide, de 1 bpm (${hold})`} aria-label="Plus rapide">
        <Icon d="M7.25 3h1.5v4.25H13v1.5H8.75V13h-1.5V8.75H3v-1.5h4.25z" />
      </Button>
    </ButtonGroup>
  );
}
