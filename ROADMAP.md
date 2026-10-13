# Feuille de route v1

## Fait

- Import MusicXML, format `.ymn` (lecture, écriture, remise en page), application de gravure A4.
- Reprises simples (`||:`, `:||`, `3×`).
- Nuances et soufflets, par main (lignes `@` sous chaque main).
- Pédale (`Ped.`, `*`, `*Ped.` sous la main gauche), tracée comme un trait sous le système.
- Sections et ordre de jeu (`*A`, `order: A A B C`), à la place des cases, D.C., D.S., segno, coda, To Coda et Fine.
- Point d'orgue (`^` sur la ligne `@` du haut).
- Petites notes (`3'5`, dans la case de la note principale), d'une seule sorte.
- Import : les indications d'octave (`8va`, `8vb`, `loco`…) sont ignorées, chaque note portant déjà son octave.

## À faire

1. **Ornements** : arpège (la vaguelette verticale devant un accord, `<arpeggiate>` en MusicXML : on égrène l'accord du grave à l'aigu), trille (`tr~~~`, alternance rapide avec la note voisine du dessus), gruppetto (∞, tour autour de la note), mordant. Le MusicXML les fournit (`<ornaments>` : `<trill-mark>`, `<wavy-line>`, `<turn>`, `<mordent>`). Piste : un signe sur la ligne `@` de la main, sur la case de la note ; la trille s'étend sur sa durée, comme un soufflet.
2. **Liaisons d'expression** : l'arc qui relie des notes différentes, à jouer lié (legato) ; il découpe les phrases. À ne pas confondre avec la liaison de prolongation entre deux notes identiques, déjà gérée : les deux notes n'en font qu'une, tenue avec `-`. Le MusicXML les fournit (`<slur>`, aujourd'hui ignoré). Piste : un intervalle sur la ligne `@` de la main, comme un soufflet (`(------)`), gravé comme un arc fin au-dessus des lignes de la main.
3. **Doigtés** (dernier ajout au format : pas encore de solution) : souvent indiqués sur les partitions, et bien pratiques. Le MusicXML les fournit (`<fingering>`). Reste à concevoir :
   - **Écriture `.ymn`** : une case fait 3 caractères et une note en prend déjà jusqu'à 2 (`12`), donc pas de place pour un doigt dans la case. Un doigt collé au numéro serait ambigu (`11` : note 11, ou note 1 avec le doigt 1 ?).
   - **Gravure** : les doigts (1 à 5) sont des chiffres comme les notes (1 à 12). Il faut une forme qu'on ne puisse pas confondre avec un numéro de note.

4. **Notice du pianiste** (`NOTICE.md`) : expliquer comment lire et penser en ymn, en partant de ce que le lecteur connaît de la partition classique. FORMAT.md reste la spécification exacte ; la notice explique le pourquoi et les correspondances. Plan :
   1. Le principe : une touche = un numéro, la position = le temps, ce qui est aligné se joue ensemble.
   2. Les hauteurs : numéros 1 à 12 au lieu des noms de notes et des altérations ; lignes d'octave au lieu des clés, des portées et des « 8va ».
   3. Le temps : la règle de comptage au lieu des figures de durée ; ce que veut dire X/Y (4/4, 3/4, 6/8, 12/8, mesures simples et composées) et ce qu'on en garde (nombre de temps, découpage en 2 ou 3) ; les étiquettes `:`, `.`, `,` ; plus besoin de points, de liaisons de tenue ni de silences ; triolets et octolets qui disparaissent (exemple : 3 contre 8 = 24 cases).
   4. Petites notes et point d'orgue : pourquoi une seule sorte de petite note, pourquoi un seul point d'orgue pour les deux mains.
   5. La structure : reprises, sections et ordre de jeu au lieu de D.C., D.S., coda, Fine.
   6. Nuances, soufflets, pédale.
   7. Un tableau récapitulatif : notation classique → ymn.

## Hors v1 pour l'instant

Articulations (staccato, accents…).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
