/** Un avis dans la barre (« Enregistré dans… », une erreur d'ouverture) : il s'efface de lui-même. */
import { useEffect, useState } from "react";

/** Le temps qu'un avis reste affiché (ms). */
const SHOWN = 3500;

export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), SHOWN);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}
