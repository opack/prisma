import { createContext } from "react";
import type { ReactNode } from "react";
import { Section } from "./Section.tsx";

export type IdeaKind = "side" | "wide" | "step";
/** Le genre de l'idée, pour son texte (IdeaText). */
export const IdeaKindContext = createContext<IdeaKind>("side");

/**
 * Une idée : son texte, et son exemple à côté (l'un sous l'autre sur un écran étroit) ; large, tout
 * l'un sous l'autre ; une étape d'Apprendre, son texte et son exemple calés en haut.
 */
export function Idea({ kind = "side", id, children }: { kind?: IdeaKind; id?: string; children: ReactNode }) {
  const layout = kind === "wide" ? "grid grid-cols-[minmax(0,1fr)] gap-6 items-center" : `grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 narrow:grid-cols-[minmax(0,1fr)] narrow:gap-6 ${kind === "step" ? "items-start" : "items-center"}`;
  return (
    <IdeaKindContext.Provider value={kind}>
      <Section className={layout} id={id}>
        {children}
      </Section>
    </IdeaKindContext.Provider>
  );
}
