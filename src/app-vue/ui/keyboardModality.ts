/**
 * Le dernier geste de la personne : le clavier, ou la souris et le doigt. Une fenêtre ouverte au
 * clavier met le focus sur son premier champ ; à la souris, sur elle-même, sans contour.
 */
let keyboard = false;
if (typeof window !== "undefined") {
  addEventListener("keydown", (event) => !event.metaKey && !event.ctrlKey && !event.altKey && (keyboard = true), true);
  addEventListener("pointerdown", () => (keyboard = false), true);
}
export const fromKeyboard = () => keyboard;
