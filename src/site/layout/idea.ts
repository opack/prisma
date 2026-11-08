/** Le genre d'une idée, que son texte (IdeaText) reçoit d'elle. */
import type { InjectionKey } from "vue";

export type IdeaKind = "side" | "wide" | "step";
export const IDEA_KIND: InjectionKey<IdeaKind> = Symbol("le genre de l'idée");
