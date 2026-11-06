/**
 * Le bouton de Prisma, sur celui de shadcn-vue : au trait (normal), plein à l'accent (primary,
 * l'action qui valide), ou discret, sans cadre (quiet) ; à bascule, allumé à l'accent (pressed) ; en
 * texte, petit (small), ou carré, pour une icône (icon), ou étroit, pour la flèche qui ouvre un
 * panneau (caret). Le contour du clavier : au clavier seulement, pas après un clic. Au doigt (touch:),
 * il grandit : 44 px de haut au moins (une icône, 44 px de côté), ses icônes de 20 px.
 */
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Button } from "./Button.vue";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 border rounded leading-tight cursor-pointer touch-manipulation outline-none focus-visible:relative focus-visible:z-2 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-default",
  {
    variants: {
      kind: {
        normal: "border-line bg-white text-ink enabled:hover:border-muted",
        primary: "border-accent bg-accent text-white enabled:hover:bg-[color-mix(in_srgb,var(--color-accent)_85%,#000)]",
        quiet: "border-transparent bg-transparent text-ink enabled:hover:bg-ink/6 aria-expanded:bg-ink/6",
      },
      size: {
        text: "px-3 py-1 touch:min-h-11 touch:px-4",
        // leading-tight après la taille du texte, que tailwind-merge ferait passer avant
        small: "px-2 py-px text-[0.9em] leading-tight touch:min-h-9 touch:px-3",
        icon: "w-[2.3em] h-[2.1em] p-0 touch:size-11 touch:[&>svg]:size-5",
        caret: "w-[1.4em] h-[2.1em] p-0 touch:w-7 touch:h-11",
      },
      // allumé, il prend l'accent à la place de son genre (Button.vue ne passe alors pas kind)
      pressed: { true: "relative z-1 border-accent bg-accent-12 text-accent" },
    },
    defaultVariants: { kind: "normal", size: "text" },
  },
);
export type ButtonVariants = VariantProps<typeof buttonVariants>;
