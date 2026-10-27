/**
 * Le retour au début d'un défilement : une flèche dans un rond, au trait de l'accent, vers le haut
 * ou vers la gauche selon le sens où l'on a défilé. Sur le site, il ramène aux parties de la page ;
 * dans l'application, au début de la partition. Sa place (className) dépend de ce qui l'entoure.
 */
export function ScrollBackButton({ direction = "up", label, onClick, className = "" }: { direction?: "up" | "left"; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`${className} grid place-items-center w-11 h-11 p-0 border-2 border-accent rounded-full bg-white text-accent cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:bg-accent-8 print:hidden`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={direction === "up" ? "M8 13V3M3.5 7.5 8 3l4.5 4.5" : "M13 8H3M7.5 3.5 3 8l4.5 4.5"} />
      </svg>
    </button>
  );
}
