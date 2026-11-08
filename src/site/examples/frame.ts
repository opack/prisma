/**
 * Le cadre d'une gravure ; dans la référence, il garde les marges et la grille de ses exemples.
 * La gravure y tient sa largeur, sauf sur un écran étroit, où le cadre défile.
 */
export function frame(guide = false): string {
  return `justify-self-start w-fit max-w-full p-4 border border-line rounded-[10px] bg-white overflow-x-auto [&_.excerpt]:block [&_.excerpt]:max-w-full [&_.excerpt]:h-auto narrow:[&_.excerpt]:max-w-none ${guide ? "mt-[14px] mb-5 grid gap-2.5 justify-items-start" : "m-0"}`;
}
