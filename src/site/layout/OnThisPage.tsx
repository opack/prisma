/**
 * Sur cette page : les parties de la page, en liens côte à côte, chacun menant à sa partie. Chaque
 * page tient la liste de ses parties (leur ancre et un nom court) et donne la même ancre à la partie.
 * Dès que la liste sort de l'écran, un bouton, en bas à droite, y ramène.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ScrollBackButton } from "../../app/ui/ScrollBackButton.tsx";

export type PagePart = { id: string; label: ReactNode };

export function OnThisPage({ parts }: { parts: PagePart[] }) {
  const nav = useRef<HTMLElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => setAway(!e.isIntersecting && e.boundingClientRect.top < 0));
    observer.observe(nav.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <nav ref={nav} className="mt-8" aria-labelledby="on-this-page">
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
      {away && <ScrollBackButton className="fixed right-6 bottom-6 z-10" label="Retour aux parties de la page" onClick={() => nav.current!.scrollIntoView({ block: "center" })} />}
    </>
  );
}
