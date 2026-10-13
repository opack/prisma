# Feuille de route v1

## Fait

- Import MusicXML, format `.ymn` (lecture, écriture, remise en page), application de gravure A4.
- Reprises et cases (`||:`, `:||`, `[1.`, `]`, `3×`).
- Nuances et soufflets, par main (lignes `@` sous chaque main).
- Pédale (`Ped.`, `*`, `*Ped.` sous la main gauche), tracée comme un trait sous le système.

## À faire

1. **Repères et sauts** : remplacent D.C., D.S., segno, coda, To Coda et Fine. Un seul mécanisme, explicite, au lieu de six mots italiens. Tout s'écrit sur la ligne `@` du haut, sur une barre de mesure, comme les cases :
   - `*A` : pose le repère A (lettre majuscule). Il se place sur le **dernier** `|` de la barre qui ouvre la mesure, comme `[1.`.
   - `->A` : saute au repère A. Il se place sur le **premier** `|` de la barre qui ferme la dernière mesure jouée, comme `]`.
   - `2.->B` : saute au repère B, au 2ᵉ passage seulement (l'ancien To Coda).
   - `2.fin` : fin du morceau, au 2ᵉ passage seulement (l'ancien Fine).
   - **Règle par défaut** : après un saut, on ne refait pas les reprises `:||` (l'usage le plus courant).
   - **Vérification** : un saut vers un repère qui n'existe pas, un repère posé deux fois.
   - **Gravure** : repères en lettres encadrées en gras au-dessus de la règle ; sauts gravés « → A » contre la barre, et « 2ᵉ fois → B ». Le passage concerné est écrit en clair, rien à retenir.
   - **Import MusicXML** : le segno et la coda (`<segno/>`, `<coda/>`, aujourd'hui perdus) deviennent des repères. D.C. devient un saut vers un repère posé en mesure 1. D.S. devient un saut vers le segno. To Coda devient `2.->` vers la coda, et Fine devient `2.fin`.
2. **Point d'orgue** 𝄐 : tenir une note, un accord ou un silence plus longtemps que sa valeur, à l'appréciation du pianiste. Le MusicXML le fournit (`<fermata>`, sur la note). Reste à choisir son signe sur la ligne `@` du haut, posé sur la case concernée, et sa gravure au-dessus de la règle.
3. **Petites notes** (ornements) : notes jouées très vite juste avant la note principale, sans compter dans les temps. Aujourd'hui l'import les ignore (`<grace>` en MusicXML). Deux sortes :
   - l'**acciaccature** (petite note barrée) : écrasée, presque en même temps que la note principale ;
   - l'**appoggiature** (petite note non barrée) : prend un peu de la durée de la note principale.
   Reste à concevoir, comme pour les doigtés : la place dans le `.ymn` (une case est déjà pleine avec sa note) et une gravure en petit, contre la note principale, qu'on ne puisse pas prendre pour une note comptée.
4. **Ornements** : trille (`tr~~~`, alternance rapide avec la note voisine du dessus), gruppetto (∞, tour autour de la note), mordant. Le MusicXML les fournit (`<ornaments>` : `<trill-mark>`, `<wavy-line>`, `<turn>`, `<mordent>`). Piste : un signe sur la ligne `@` de la main, sur la case de la note ; la trille s'étend sur sa durée, comme un soufflet.
5. **Liaisons d'expression** : l'arc qui relie des notes différentes, à jouer lié (legato) ; il découpe les phrases. À ne pas confondre avec la liaison de prolongation entre deux notes identiques, déjà gérée : les deux notes n'en font qu'une, tenue avec `-`. Le MusicXML les fournit (`<slur>`, aujourd'hui ignoré). Piste : un intervalle sur la ligne `@` de la main, comme un soufflet (`(------)`), gravé comme un arc fin au-dessus des lignes de la main.
6. **Doigtés** (en dernier : pas encore de solution) : souvent indiqués sur les partitions, et bien pratiques. Le MusicXML les fournit (`<fingering>`). Reste à concevoir :
   - **Écriture `.ymn`** : une case fait 3 caractères et une note en prend déjà jusqu'à 2 (`12`), donc pas de place pour un doigt dans la case. Un doigt collé au numéro serait ambigu (`11` : note 11, ou note 1 avec le doigt 1 ?).
   - **Gravure** : les doigts (1 à 5) sont des chiffres comme les notes (1 à 12). Il faut une forme qu'on ne puisse pas confondre avec un numéro de note.

## Hors v1 pour l'instant

Articulations (staccato, accents…).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
