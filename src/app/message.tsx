/**
 * Un message de lecture, à l'écran : ce qui y est cité du texte, entre guillemets (« 9e »,
 * « N~N », « parts »), s'écrit comme du texte .prisma, en chasse fixe, pour ressortir. Le message
 * lui-même garde ses guillemets : en ligne de commande, ils restent tels quels.
 */
import type { ReactNode } from "react";

const QUOTED = /« ([^»]*?) »/g;

/** Les morceaux d'un message : du texte, ou une citation du texte .prisma. */
function pieces(message: string): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = [];
  let at = 0;
  for (const m of message.matchAll(QUOTED)) {
    if (m.index > at) out.push({ text: message.slice(at, m.index), code: false });
    out.push({ text: m[1], code: true });
    at = m.index + m[0].length;
  }
  if (at < message.length) out.push({ text: message.slice(at), code: false });
  return out;
}

export function Message({ text }: { text: string }): ReactNode {
  return pieces(text).map((p, k) => (p.code ? <code key={k}>{p.text}</code> : p.text));
}

/** Le même, en éléments du DOM, pour l'infobulle de l'éditeur. */
export function messageNode(text: string): Node {
  const span = document.createElement("span");
  for (const p of pieces(text)) {
    if (!p.code) span.append(p.text);
    else {
      const code = document.createElement("code");
      code.textContent = p.text;
      span.append(code);
    }
  }
  return span;
}
