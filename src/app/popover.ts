/**
 * Petit panneau ouvert depuis un bouton (la liste des parties, les réglages de la gravure) : il se
 * ferme avec Échap ou par un clic ailleurs.
 */
import { useEffect, useRef, useState } from "react";

export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const root = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", outside);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", outside);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, root };
}
