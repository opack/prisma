/** Le retour à la partition, en haut à gauche d'un panneau (la bibliothèque, la référence) : il reste en vue. */
import { BackIcon } from "./icons.tsx";
import { IconButton } from "./IconButton.tsx";

export function BackButton({ onClick, shortcut }: { onClick: () => void; shortcut?: string }) {
  return (
    <IconButton className="sticky top-3 z-1 mt-3 ml-4" label="Retour à la partition" title={`Retour à la partition${shortcut ? ` (${shortcut})` : ""}`} onClick={onClick}>
      <BackIcon />
    </IconButton>
  );
}
