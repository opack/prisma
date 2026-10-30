/** Le haut et le bas des pages du site. */
import { Menu, MenuItem, MenuTrigger, Popover, Pressable } from "react-aria-components";
import { Button } from "../../app/ui/button/Button.tsx";
import { Logo } from "../../app/ui/Logo.tsx";
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

/** Les pages du site, dans un menu : celle où l'on est, comme le texte. */
function PagesMenu({ current }: { current: Page }) {
  return (
    <MenuTrigger>
      {/* sur un téléphone seulement */}
      <span className="hidden phone:flex">
        <Pressable>
          <Button size="icon" title="Pages du site" aria-label="Pages du site">
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden>
              <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M2.5 4h11M2.5 8h11M2.5 12h11" />
            </svg>
          </Button>
        </Pressable>
      </span>
      <Popover className="min-w-[260px] p-1.5 bg-white border border-line rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] outline-none" placement="bottom end" offset={6}>
        <Menu className="grid outline-none" aria-label="Pages du site">
          {PAGES.map(([page, label]) => (
            <MenuItem key={page} href={`${page}.html`} className={`px-2.5 py-2 rounded no-underline outline-none data-focused:bg-panel ${page === current ? "text-ink" : "text-accent"}`}>
              {label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function Header({ current }: { current: Page }) {
  return (
    <header className={`${FRAME} phone:flex-nowrap`}>
      <a className="inline-flex items-center gap-2 font-bold text-[1.4rem] text-ink no-underline tracking-[-0.01em]" href="index.html">
        <Logo className="size-7" />
        Prisma
      </a>
      <nav className={`${NAV} phone:flex-nowrap phone:gap-2`} aria-label="Pages du site">
        {PAGES.map(([page, label]) => (
          <PageLink key={page} page={page} current={current} label={label} className="phone:hidden" />
        ))}
        <ButtonLink primary small href={APP}>
          Ouvrir l'application
        </ButtonLink>
        {/* sur un téléphone, les pages sous un bouton */}
        <PagesMenu current={current} />
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
