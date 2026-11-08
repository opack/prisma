/**
 * Un nom, en texte ou en morceau de gabarit (« Le <i>fa dièse</i> ») : les entrées d'un sommaire
 * le montrent tel quel.
 */
import type { FunctionalComponent, VNode } from "vue";

export type Label = string | VNode;

const RichLabel: FunctionalComponent<{ label: Label }> = ({ label }) => label;
export default RichLabel;
