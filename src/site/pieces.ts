/** Les exemples du site, écrits pour lui, au plus simple (« Au clair de la lune » et « Greensleeves » sont des airs traditionnels). */

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

// la guitare et la basse : les exemples de la page guitare.html

/** Les quatre premières mesures de « Greensleeves » (air traditionnel), à la guitare : la mélodie et sa basse. */
export const GREENSLEEVES = `---
format: 1
title: Greensleeves
composer: Air traditionnel
bpm: 90
parts: Guitare
---

m1 |1  |2  |3  ||1  |2  *  |3  ||1  |2  |3  ||1  |2  *  |3  ||
───┼─ Guitare ─┼┼───┼──────┼───┼┼───┼───┼───┼┼───┼──────┼───┼┼
1  |   |   |   ||0  |-  1  |0  ||   |   |   ||   |      |   ||
2  |1  |-  |3  ||   |      |   ||3  |-  |0  ||   |      |0  ||
3  |   |   |   ||   |      |   ||   |   |   ||0  |-  2  |   ||
5  |0  |-  |-  ||3  |-  -  |-  ||   |   |   ||   |      |   ||
6  |   |   |   ||   |      |   ||3  |-  |-  ||0  |-  -  |-  ||
`;

/** Les mêmes mesures, avec leurs accords sur la ligne `@c`. */
export const GREENSLEEVES_CHORDS = `---
format: 1
title: Greensleeves
composer: Air traditionnel
bpm: 90
parts: Guitare
---

@c  10:m           1               8            5:m
m1 |1    |2  |3  ||1  |2  *  |3  ||1  |2  |3  ||1   |2  *  |3  ||
───┼─ Guitare ───┼┼───┼──────┼───┼┼───┼───┼───┼┼────┼──────┼───┼┼
1  |     |   |   ||0  |-  1  |0  ||   |   |   ||    |      |   ||
2  |1    |-  |3  ||   |      |   ||3  |-  |0  ||    |      |0  ||
3  |     |   |   ||   |      |   ||   |   |   ||0   |-  2  |   ||
5  |0    |-  |-  ||3  |-  -  |-  ||   |   |   ||    |      |   ||
6  |     |   |   ||   |      |   ||3  |-  |-  ||0   |-  -  |-  ||
`;

/** La gamme pentatonique de *mi* mineur, en première position : deux cases par corde, du grave à l'aigu. */
export const PENTATONIC = `---
format: 1
parts: Guitare
---

m1 |1  *  |2  *  |3  *  |4  *  ||1  *  |2  *  |3  |4  ||
───┼─ Guitare ───┼──────┼──────┼┼──────┼──────┼───┼───┼┼
1  |      |      |      |      ||      |0  3  |-  |-  ||
2  |      |      |      |      ||0  3  |      |   |   ||
3  |      |      |      |0  2  ||      |      |   |   ||
4  |      |      |0  2  |      ||      |      |   |   ||
5  |      |0  2  |      |      ||      |      |   |   ||
6  |0  3  |      |      |      ||      |      |   |   ||
`;

/** Un arpège de *la* mineur, chaque corde laissée sonner, puis un arpège de *mi* où seule la basse tient. */
export const RING = `---
format: 1
parts: Guitare
---

m1 |1  *  |2  *  |3  |4  ||1  *  |2  *  |3  *  |4  ||
───┼─ Guitare ───┼───┼───┼┼──────┼──────┼──────┼───┼┼
1  |      |      |0  |-  ||      |      |   0  |   ||
2  |      |   1  |-  |-  ||      |      |0     |   ||
3  |      |2  -  |-  |-  ||      |   1  |      |   ||
4  |   2  |-  -  |-  |-  ||      |2     |      |   ||
5  |0  -  |-  -  |-  |-  ||   2  |      |      |   ||
6  |      |      |   |   ||0  -  |-  -  |-  -  |-  ||
`;

/** En accordage drop-d : un doigt couché sur les trois cordes graves joue l'accord de puissance. */
export const DROP_D = `---
format: 1
parts: Guitare (drop-d)
---

m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||
───┼─ Guitare ─┼───┼┼───┼───┼───┼───┼┼
4  |0  |   |3  |5  ||0  |-  |   |   ||
5  |0  |   |3  |5  ||0  |-  |   |   ||
6  |0  |   |3  |5  ||0  |-  |   |   ||
`;

/** À la basse : la fondamentale et la quinte, sur la corde de *la* puis de *ré*. */
export const BASS = `---
format: 1
parts: Basse électrique
---

m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||
───┼─ Basse électrique ─┼───┼───┼───┼┼
2  |   |2  |   |2  ||   |5  |   |5  ||
3  |0  |   |0  |   ||3  |   |3  |   ||
`;

/** Les techniques des cordes, celles de la référence : harmonique, note étouffée, bend relâché, glissé, pull-off et hammer-on, médiator, étouffé de la paume, vibrato. */
export const TECHNIQUES = `---
format: 1
parts: Guitare
---

m1 |1    |2  |3    |4  ||1  |2  |3  |4     ||
───┼─ Guitare ─────┼───┼┼───┼───┼───┼──────┼┼
1  |<12> |x  |7b9r |5/ ||8  |5  |7  |10b12 ||
3  |5    |7  |     |   ||   |   |   |      ||
@                        (--------)
@   d     u   P.M.----           ~~~~~~~~~
`;
