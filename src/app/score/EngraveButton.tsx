/**
 * Graver : un bouton flottant en bas de l'éditeur, contre les pages. Il refait les pages d'après le
 * texte (Ctrl+Entrée), sa flèche ouvre le choix de graver automatiquement. Il n'est actif que s'il
 * y a quelque chose à graver : un texte modifié depuis la dernière gravure, sans gravure automatique.
 */
import { Popover } from "../ui/popover/Popover.tsx";
import { PopoverCheck } from "../ui/popover/PopoverCheck.tsx";
import { PopoverHint } from "../ui/popover/PopoverHint.tsx";
import { DialogTrigger, Pressable } from "react-aria-components";
import { Button } from "../ui/button/Button.tsx";
import { ButtonGroup } from "../ui/button/ButtonGroup.tsx";

export function EngraveButton({ dirty, auto, onEngrave, onAuto }: { dirty: boolean; auto: boolean; onEngrave: () => void; onAuto: (auto: boolean) => void }) {
  const title = auto ? "Mise en page automatique : les pages suivent le texte" : dirty ? "Mettre en page le texte modifié (Ctrl+Entrée)" : "Rien à mettre en page : les pages sont à jour";
  return (
    // sur un fond blanc : éteint, le bouton pâlit sans laisser voir le texte dessous
    <ButtonGroup className="absolute right-6 bottom-5 z-2 bg-white rounded shadow-[0_2px_6px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.1)]">
      <Button kind="primary" size="icon" onClick={onEngrave} disabled={auto || !dirty} title={title} aria-label="Mettre en page">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13.5 6.5A5.6 5.6 0 0 0 3 5M2.5 9.5A5.6 5.6 0 0 0 13 11" />
          <path d="M3 1.8V5h3.2M13 14.2V11H9.8" />
        </svg>
      </Button>
      <DialogTrigger>
        <Pressable>
          <Button kind="primary" size="caret" title="Réglages de la mise en page" aria-label="Réglages de la mise en page">
            <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden>
              <path d="M1 9.5h6L4 6z" fill="currentColor" />
            </svg>
          </Button>
        </Pressable>
        <Popover label="Réglages de la mise en page" above className="w-min min-w-[240px]">
          <PopoverCheck checked={auto} onChange={onAuto}>
            Mettre en page automatiquement
          </PopoverCheck>
          <PopoverHint>La mise en page suit la saisie, peu après la dernière frappe.</PopoverHint>
        </Popover>
      </DialogTrigger>
    </ButtonGroup>
  );
}
