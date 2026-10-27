/** Le retour à la partition, en haut à gauche d'un panneau (la bibliothèque, la référence) : il reste en vue. */
import { BackIcon } from "../icons.tsx";
import { Button } from "./Button.tsx";

export function BackButton({ onClick, shortcut }: { onClick: () => void; shortcut?: string }) {
  const label = "Retour à la partition";
  return (
    <Button className="sticky top-3 z-1 mt-3 ml-4" size="icon" onClick={onClick} title={`${label}${shortcut ? ` (${shortcut})` : ""}`} aria-label={label}>
      <BackIcon />
    </Button>
  );
}
