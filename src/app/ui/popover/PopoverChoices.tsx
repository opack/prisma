/** Un choix d'un panneau, parmi quelques-uns : chaque possibilité, et ce qu'elle fait, dessous. */
import { HINT } from "./hint.ts";

export type PopoverOption<T> = { value: T; label: string; hint: string };

export function PopoverChoices<T>({ name, options, value, onChange }: { name: string; options: PopoverOption<T>[]; value: T; onChange: (value: T) => void }) {
  return options.map((o) => <PopoverChoice key={String(o.value)} name={name} option={o} checked={o.value === value} onChange={() => onChange(o.value)} />);
}

function PopoverChoice<T>({ name, option, checked, onChange }: { name: string; option: PopoverOption<T>; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex gap-2 items-start cursor-pointer whitespace-normal">
      <input className="mt-[3px] accent-accent" type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        {option.label}
        <span className={`${HINT} block`}>{option.hint}</span>
      </span>
    </label>
  );
}
