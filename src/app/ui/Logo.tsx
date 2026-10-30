/**
 * Le logo de Prisma : le « P » à la couleur de l'accent, sur la bande des douze notes ; le même
 * fichier que l'icône des onglets (public/icons/logo.svg). Décoratif : le nom l'accompagne. Sa
 * taille, className, dépend de ce qui l'entoure.
 */
export function Logo({ className = "" }: { className?: string }) {
  return <img className={`${className} flex-none`} src="/icons/logo.svg" alt="" aria-hidden />;
}
