/** Le haut et le bas des pages du site. */
import { ButtonLink } from "./ButtonLink.tsx";

/** Le haut et le bas : la largeur des pages, le nom (ou une phrase) à gauche, les liens à droite. */
const FRAME = "max-w-[1160px] mx-auto px-6 py-[18px] flex flex-wrap items-center justify-between gap-3";
const NAV = "flex flex-wrap items-center gap-5";

/** L'application, dans le dossier app/ du site. */
export const APP = "app/";

/** Les pages du site, dans l'ordre de la navigation. */
const PAGES = [
  ["apprendre", "Apprendre"],
  ["reference", "Référence"],
  ["guitare", "Guitare et basse"],
  ["comparaison", "Prisma et la partition classique"],
] as const;
export type Page = "index" | (typeof PAGES)[number][0];

/** Le lien d'une page ; celui de la page où l'on est s'écrit comme le texte, sans soulignement. */
function PageLink({ page, current, label, className = "" }: { page: Page; current: Page; label: string; className?: string }) {
  return (
    <a className={`${className} aria-[current=page]:text-ink aria-[current=page]:no-underline`} href={`${page}.html`} aria-current={page === current ? "page" : undefined}>
      {label}
    </a>
  );
}

export function Header({ current }: { current: Page }) {
  return (
    <header className={`${FRAME} phone:flex-nowrap`}>
      <a className="font-bold text-[1.4rem] text-ink no-underline tracking-[-0.01em]" href="index.html">
        Prisma
      </a>
      <nav className={NAV} aria-label="Pages du site">
        {PAGES.map(([page, label]) => (
          <PageLink key={page} page={page} current={current} label={label} className="phone:hidden" />
        ))}
        <ButtonLink primary small href={APP}>
          Ouvrir l'application
        </ButtonLink>
      </nav>
    </header>
  );
}

export function Footer({ current }: { current: Page }) {
  return (
    <footer className={`${FRAME} mt-12 border-t border-line text-muted text-[0.95rem]`}>
      <p className="mb-0">Prisma, une notation chromatique de la musique.</p>
      <nav className={NAV} aria-label="Pages du site">
        <PageLink page="index" current={current} label="Accueil" />
        {PAGES.map(([page, label]) => (
          <PageLink key={page} page={page} current={current} label={label} />
        ))}
        <a href={APP}>L'application</a>
      </nav>
    </footer>
  );
}
