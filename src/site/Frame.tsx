/** Le haut et le bas des pages du site. */

/** L'application, dans le dossier app/ du site. */
export const APP = "app/";

export function Header() {
  return (
    <header className="site-header">
      <a className="wordmark" href="index.html">
        Prisma
      </a>
      <nav aria-label="Pages du site">
        <a href="apprendre.html">Apprendre</a>
        <a href="reference.html">Référence</a>
        <a href="comparaison.html">Prisma et la partition classique</a>
        <a className="button primary small" href={APP}>
          Ouvrir l'application
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <p>Prisma, une notation chromatique de la musique.</p>
      <nav aria-label="Pages du site">
        <a href="index.html">Accueil</a>
        <a href="apprendre.html">Apprendre</a>
        <a href="reference.html">Référence</a>
        <a href="comparaison.html">Prisma et la partition classique</a>
        <a href={APP}>L'application</a>
      </nav>
    </footer>
  );
}
