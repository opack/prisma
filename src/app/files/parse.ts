/** Le texte lu en partition, ou ce qui l'en empêche (sans Vue : useDocument s'en sert). */
import { PrismaError, parsePrisma } from "../../core/index.ts";
import type { Score } from "../../core/index.ts";

/** Ce qui empêche la mise en page, et où, dans le texte. */
export type Problem = { message: string; line?: number; column?: number };

/** Le texte lu en partition, ou son erreur ; un texte vide (nouvelle partition) : rien à graver, ce n'est pas une erreur. */
export function tryParse(text: string): { score?: Score; problem?: Problem } {
  if (!text.trim()) return {};
  try {
    return { score: parsePrisma(text) };
  } catch (error) {
    if (error instanceof PrismaError) return { problem: { message: error.message, line: error.line, column: error.column } };
    return { problem: { message: (error as Error).message } };
  }
}
