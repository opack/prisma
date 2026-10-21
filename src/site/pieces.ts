/** Les exemples du site, écrits pour lui, au plus simple (« Au clair de la lune » est un air traditionnel). */

export const SCALE = `---
format: 1
---

m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||
───┼───┼───┼───┼───┼┼───┼───┼───┼───┼┼
+1 |   |   |   |   ||   |   |   |1  ||
0  |1  |3  |5  |6  ||8  |10 |12 |   ||
`;

export const LANES = `---
format: 1
---

m1 |1  |2  |3  |4  ||
───┼───┼───┼───┼───┼┼
+1 |   |   |   |5  ||
0  |   |   |5  |   ||
-1 |   |5  |   |   ||
-2 |5  |   |   |   ||
`;

export const RULER = `---
format: 1
---

m1 |1  |2  |3  *  |4  ||
───┼───┼───┼──────┼───┼┼
0  |1  |-  |5  6  |8  ||
`;

export const CLAIR = `---
format: 1
title: Au clair de la lune
composer: Air traditionnel
bpm: 100
---

m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |1  |1  |3  ||5  |-  |3  |-  ||1  |5  |3  |3  ||1  |-  |-  |-  ||
---
-1 |1  |-  |-  |-  ||8  |-  |-  |-  ||1  |-  |8  |-  ||1  |-  |-  |-  ||
`;

/** Le même air en entier : la partie A, la partie B, et l'ordre de jeu A A B A écrit une fois en tête. */
export const CLAIR_SECTIONS = `---
format: 1
title: Au clair de la lune
composer: Air traditionnel
bpm: 100
order: A A B A
---

@  [A]
m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |1  |1  |3  ||5  |-  |3  |-  ||1  |5  |3  |3  ||1  |-  |-  |-  ||
---
-1 |1  |-  |-  |-  ||8  |-  |-  |-  ||1  |-  |8  |-  ||1  |-  |-  |-  ||

@  [B]
m5 |1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |3  |3  |3  |3  ||   |   |   |   ||3  |1  |   |   ||   |   |   |   ||
-1 |   |   |   |   ||10 |-  |10 |-  ||   |   |12 |10 ||8  |-  |-  |-  ||
---
-1 |   |   |   |   ||3  |-  |-  |-  ||   |   |3  |-  ||   |   |   |   ||
-2 |8  |-  |-  |-  ||   |   |   |   ||8  |-  |   |   ||8  |-  |-  |-  ||
`;

/** Quatre accords sur do : changer un nombre change l'accord. */
export const CHORDS = `---
format: 1
---

@c  1   1:m 1:7 1:dim
m1 |1  |2  |3  |4  ||
0  |   |   |11 |   ||
   |8  |8  |8  |7  ||
   |5  |4  |5  |4  ||
   |1  |1  |1  |1  ||
`;

/** Do mi sol et mi sol si : même forme sur la portée, mais pas les mêmes écarts. */
export const TWO_CHORDS = `---
format: 1
---

@c  1   5:m
m1 |1  |2  ||
0  |8  |12 ||
   |5  |8  ||
   |1  |5  ||
`;
