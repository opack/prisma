/**
 * Pendant la lecture d'une page, une fois passé son haut (l'élément `start`) : ses parties sous un
 * bouton fixé en haut de l'écran, qui dit celle qu'on lit ; et, en bas à droite, un
 * bouton qui ramène en haut (`back`). Une partie choisie arrive sous le bouton du haut.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ContentsMenu } from "../../app/ui/ContentsMenu.tsx";
import { ScrollBackButton } from "../../app/ui/button/ScrollBackButton.tsx";

export type PagePart = { id: string; label: ReactNode };

/** La place que prend le bouton du haut, au-dessus d'une partie qu'on y amène (px). */
const BAR = 64;

export function PartsBar({ parts, start, back }: { parts: PagePart[]; start: string; back: { label: string; onClick: () => void } }) {
  const [away, setAway] = useState(false);
  const [current, setCurrent] = useState<string>();
  // les ancres des parties : la page refait sa liste à chaque rendu, elles ne changent pas
  const ids = parts.map((p) => p.id).join(" ");
  useEffect(() => {
    let frame = 0;
    const spy = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setAway((document.getElementById(start)?.getBoundingClientRect().bottom ?? 1) < 0);
        // la partie lue : la dernière dont le haut est passé sous le bouton du haut
        setCurrent(ids.split(" ").filter((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= BAR + 16).pop());
      });
    };
    spy();
    addEventListener("scroll", spy, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", spy);
    };
  }, [ids, start]);
  if (!away) return null;
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - BAR, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <>
      <ContentsMenu className="fixed inset-x-0 top-0 z-20" title="Sur cette page" entries={parts} current={current} onGo={go} />
      <ScrollBackButton className="fixed right-6 bottom-6 z-10" label={back.label} onClick={back.onClick} />
    </>
  );
}
