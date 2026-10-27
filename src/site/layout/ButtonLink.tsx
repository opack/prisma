import type { ReactNode } from "react";

/** Un lien en bouton : plein (l'appel principal) ou au trait ; petit, dans le haut des pages. */
export function ButtonLink({ href, primary = false, small = false, children }: { href: string; primary?: boolean; small?: boolean; children: ReactNode }) {
  const size = small ? "px-3.5 py-1.5 text-[0.95rem] whitespace-nowrap" : "px-5 py-[11px]";
  const tone = primary ? "bg-accent text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_88%,#000)]" : "bg-white text-accent hover:bg-accent-8";
  return (
    <a className={`inline-block border-2 border-accent rounded-lg font-bold no-underline ${size} ${tone}`} href={href}>
      {children}
    </a>
  );
}
