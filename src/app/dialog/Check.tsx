/** Une case à cocher d'une fenêtre, en retrait sous les choix qu'elle complète. */
import type { ReactNode } from "react";

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex gap-2 items-center mt-0.5 ml-3 cursor-pointer">
      <input className="m-0 accent-accent" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
