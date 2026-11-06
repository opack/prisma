/**
 * Ce que tient un module hors de Vue (le lecteur, le suivi de la lecture, le signe montré du texte) :
 * relu dans un ref à chaque changement qu'il annonce, jusqu'à la fin du composant qui le suit.
 */
import { getCurrentScope, onScopeDispose, shallowRef } from "vue";
import type { Ref } from "vue";

export function useExternal<T>(subscribe: (listener: () => void) => () => unknown, read: () => T): Readonly<Ref<T>> {
  const value = shallowRef(read());
  const stop = subscribe(() => (value.value = read()));
  if (getCurrentScope()) onScopeDispose(() => void stop());
  return value;
}
