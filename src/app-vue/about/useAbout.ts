/**
 * La fenêtre « À propos » : ouverte depuis Aide, ou d'elle-même une fois quand l'application vient
 * d'être mise à jour vers une version plus récente, pour en montrer les nouveautés. La dernière
 * version vue est gardée dans le navigateur.
 */
import { ref } from "vue";
import { updatedSince } from "../../app/about/changelog.ts";

const SEEN = "prisma:version";

export function useAbout() {
  const shown = ref(updatedSince(localStorage.getItem(SEEN), __VERSION__));
  localStorage.setItem(SEEN, __VERSION__);
  return { shown, open: () => (shown.value = true), close: () => (shown.value = false) };
}
