/**
 * Un choix d'une fenêtre, parmi quelques-uns, sous son nom : chaque possibilité en carte, son nom et
 * ce qu'elle fait ; celle qui est prise, à la couleur de l'accent. Ce qui la complète (une case à
 * cocher) suit les cartes.
 */
import type { ReactNode } from "react";

export type ChoiceOption<T> = { value: T; label: string; hint: string };

export function Choices<T>({ legend, name, options, value, onChange, children }: { legend: string; name: string; options: ChoiceOption<T>[]; value: T; onChange: (value: T) => void; children?: ReactNode }) {
  return (
    <fieldset className="grid gap-2 m-0 p-0 border-0">
      <legend className="mb-1.5 p-0 font-semibold">{legend}</legend>
      {options.map((o) => (
        <Choice key={String(o.value)} name={name} option={o} checked={o.value === value} onChange={() => onChange(o.value)} />
      ))}
      {children}
    </fieldset>
  );
}

function Choice<T>({ name, option, checked, onChange }: { name: string; option: ChoiceOption<T>; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex gap-2.5 items-start px-3 py-2.5 border rounded-md cursor-pointer ${checked ? "border-accent bg-accent-7" : "border-line bg-white"}`}>
      <input className="mt-[3px] mb-0 mx-0 accent-accent" type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        <span className="block font-semibold">{option.label}</span>
        <span className="block mt-0.5 text-muted text-[0.92em] leading-[1.35]">{option.hint}</span>
      </span>
    </label>
  );
}
