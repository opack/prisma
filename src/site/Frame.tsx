/** Le haut et le bas des pages du site. */
import { ButtonLink } from "./ButtonLink.tsx";

/** Le haut et le bas : la largeur des pages, le nom (ou une phrase) à gauche, les liens à droite. */
const FRAME = "max-w-[1160px] mx-auto px-6 py-[18px] flex flex-wrap items-center justify-between gap-3";
const NAV = "flex flex-wrap items-center gap-5";

/** L'application, dans le dossier app/ du site. */
export const APP = "app/";

export function Header() {
  return (
    <header className={`${FRAME} phone:flex-nowrap`}>
      <a className="font-bold text-[1.4rem] text-ink no-underline tracking-[-0.01em]" href="index.html">
        Prisma
      </a>
      <nav className={NAV} aria-label="Pages du site">
        <a className="phone:hidden" href="apprendre.html">Apprendre</a>
        <a className="phone:hidden" href="reference.html">Référence</a>
        <a className="phone:hidden" href="guitare.html">Guitare et basse</a>
        <a className="phone:hidden" href="comparaison.html">Prisma et la partition classique</a>
        <ButtonLink primary small href={APP}>
          Ouvrir l'application
        </ButtonLink>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className={`${FRAME} mt-12 border-t border-line text-muted text-[0.95rem]`}>
      <p className="mb-0">Prisma, une notation chromatique de la musique.</p>
      <nav className={NAV} aria-label="Pages du site">
        <a href="index.html">Accueil</a>
        <a href="apprendre.html">Apprendre</a>
        <a href="reference.html">Référence</a>
        <a href="guitare.html">Guitare et basse</a>
        <a href="comparaison.html">Prisma et la partition classique</a>
        <a href={APP}>L'application</a>
      </nav>
    </footer>
  );
}
