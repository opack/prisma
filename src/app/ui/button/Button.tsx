/**
 * Un bouton : au trait (normal), plein à l'accent (primary, l'action qui valide), ou discret, sans
 * cadre (quiet) ; à bascule, allumé à l'accent (pressed) ; en texte, petit (small), ou carré, pour
 * une icône (icon), ou étroit, pour la flèche qui ouvre un panneau (caret). Le contour du clavier est celui que décide React Aria : au clavier seulement, pas
 * après un clic. Sa place (className) dépend de ce qui l'entoure ; ses autres attributs (title,
 * aria-label, onClick…) passent au bouton. Dans un MenuTrigger ou un DialogTrigger, il se pose dans
 * un Pressable de React Aria.
 */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { mergeProps, useFocusRing } from "react-aria";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "normal" | "primary" | "quiet"; pressed?: boolean; size?: "text" | "small" | "icon" | "caret" };

const KINDS = {
  normal: "border-line bg-white text-ink enabled:hover:border-muted",
  primary: "border-accent bg-accent text-white enabled:hover:bg-[color-mix(in_srgb,var(--color-accent)_85%,#000)]",
  quiet: "border-transparent bg-transparent text-ink enabled:hover:bg-ink/6 aria-expanded:bg-ink/6",
};
const PRESSED = "relative z-1 border-accent bg-accent-12 text-accent";
const SIZES = { text: "px-3 py-1", small: "px-2 py-px text-[0.9em]", icon: "w-[2.3em] h-[2.1em] p-0", caret: "w-[1.4em] h-[2.1em] p-0" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ kind = "normal", pressed, size = "text", className = "", type = "button", ...props }, ref) {
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <button
      {...mergeProps(props, focusProps)}
      ref={ref}
      type={type}
      aria-pressed={pressed}
      data-focus-visible={isFocusVisible || undefined}
      className={`${className} inline-flex items-center justify-center gap-1.5 border rounded leading-tight cursor-pointer outline-none data-focus-visible:relative data-focus-visible:z-2 data-focus-visible:outline-solid data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-accent disabled:opacity-50 disabled:cursor-default ${pressed ? PRESSED : KINDS[kind]} ${SIZES[size]}`}
    />
  );
});
