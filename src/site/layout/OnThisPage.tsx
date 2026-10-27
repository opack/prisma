/**
 * Sur cette page : les parties de la page, en liens côte à côte, chacun menant à sa partie. Chaque
 * page tient la liste de ses parties (leur ancre et un nom court) et donne la même ancre à la partie.
 * Dès que la liste sort de l'écran, les parties passent sous un bouton fixé en haut, et un
 * bouton, en bas à droite, y ramène (PartsBar).
 */
import { PartsBar } from "./PartsBar.tsx";
import type { PagePart } from "./PartsBar.tsx";

export function OnThisPage({ parts }: { parts: PagePart[] }) {
  return (
    <>
      <nav className="mt-8" id="sur-cette-page" aria-labelledby="on-this-page">
        <p className="mb-2 text-[0.95rem] text-muted" id="on-this-page">
          Sur cette page
        </p>
        <ul className="flex flex-wrap gap-2 m-0 p-0 list-none">
          {parts.map((p) => (
            <li key={p.id}>
              <a className="inline-block px-3 py-1 border border-line rounded-full bg-white text-[0.95rem] text-ink no-underline hover:border-accent hover:text-accent" href={`#${p.id}`}>
                {p.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <PartsBar parts={parts} start="sur-cette-page" back={{ label: "Retour aux parties de la page", onClick: () => document.getElementById("sur-cette-page")!.scrollIntoView({ block: "center" }) }} />
    </>
  );
}
