import type { ReactNode } from "react";

/** Le chapeau d'une page, sous son titre. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[1.25rem] text-[#303437] max-w-[34em]">{children}</p>;
}
