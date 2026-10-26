/** Une case à cocher d'un panneau, et son texte. */
import type { ReactNode } from "react";

export function PopoverCheck({ checked, onChange, className = "", children }: { checked: boolean; onChange: (checked: boolean) => void; className?: string; children: ReactNode }) {
  return (
    <label className={`flex gap-2 items-center cursor-pointer whitespace-nowrap ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
