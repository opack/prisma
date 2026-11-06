/**
 * Le nom du fichier ouvert, suivi d'un point à la couleur de l'accent tant qu'il y a des
 * modifications non enregistrées (dit en toutes lettres aux lecteurs d'écran). D'un seul tenant :
 * sans espace entre le nom et le point, que la mise en forme d'un gabarit ajouterait.
 */
import { h } from "vue";
import type { FunctionalComponent } from "vue";

const FileName: FunctionalComponent<{ name: string; saved: boolean }> = ({ name, saved }) =>
  saved
    ? name
    : [name, h("span", { class: "text-accent", "aria-hidden": "true" }, " ●"), h("span", { class: "sr-only" }, ", non enregistré")];
FileName.props = ["name", "saved"];
export default FileName;
