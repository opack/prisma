/**
 * Un message de lecture, à l'écran : ce qui y est cité du texte, entre guillemets (« 9e »,
 * « N~N », « parts »), s'écrit comme du texte .prisma, en chasse fixe, pour ressortir (Message.vue,
 * et messageNode pour l'infobulle de l'éditeur).
 */

const QUOTED = /« ([^»]*?) »/g;
export const CODE = "font-mono text-[0.92em] px-1 rounded-[3px] bg-[rgba(27,29,31,0.07)] whitespace-pre";

/** Les morceaux d'un message : du texte, ou une citation du texte .prisma. */
export function pieces(message: string): { text: string; code: boolean }[] {
  const out: { text: string; code: boolean }[] = [];
  let at = 0;
  for (const match of message.matchAll(QUOTED)) {
    if (match.index > at) out.push({ text: message.slice(at, match.index), code: false });
    out.push({ text: match[1], code: true });
    at = match.index + match[0].length;
  }
  if (at < message.length) out.push({ text: message.slice(at), code: false });
  return out;
}

/** Le même, en éléments du DOM, pour l'infobulle de l'éditeur. */
export function messageNode(text: string): Node {
  const span = document.createElement("span");
  for (const piece of pieces(text)) {
    if (!piece.code) span.append(piece.text);
    else {
      const code = document.createElement("code");
      code.className = CODE;
      code.textContent = piece.text;
      span.append(code);
    }
  }
  return span;
}
