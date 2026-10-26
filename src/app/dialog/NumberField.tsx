/** Un nombre à saisir dans une fenêtre, sous son nom. */
import { FIELD, FIELD_LABEL } from "./field.ts";

export function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className={FIELD_LABEL}>
      {label}
      <input className={FIELD} type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
