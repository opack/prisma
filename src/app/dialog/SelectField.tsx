/** Une liste déroulante d'une fenêtre, sous son nom. */
import type { ReactNode } from "react";
import { FIELD, FIELD_LABEL } from "./field.ts";

export function SelectField({ label, value, onChange, children }: { label: string; value: string | number; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className={FIELD_LABEL}>
      {label}
      <select className={FIELD} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
