/**
 * Un clavier d'une octave, pour montrer des notes Prisma (1 à 12) sur leurs touches : les numéros
 * sont les touches, dans l'ordre, du do (1) au si (12) (MiniKeyboard, KeyboardPicker).
 */

/** Les touches blanches, de gauche à droite, et les noires avec leur place (en largeurs de touche blanche). */
export const WHITE = [1, 3, 5, 6, 8, 10, 12];
export const BLACK: [number, number][] = [
  [2, 1],
  [4, 2],
  [7, 4],
  [9, 5],
  [11, 6],
];
