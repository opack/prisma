# Feuille de route v1

## Fait

- Import MusicXML, format `.ymn` (lecture, écriture, remise en page), application de gravure A4.
- Reprises simples (`||:`, `:||`, `3×`).
- Nuances et soufflets, par partie (lignes `@` sous chaque partie).
- Pédale (`Ped.`, `*`, `*Ped.` sous la dernière partie de l'instrument), tracée comme un trait sous lui.
- Sections et ordre de jeu (`[A]`, `order: A A B C`), à la place des cases, D.C., D.S., segno, coda, To Coda et Fine.
- Point d'orgue (`^` sur la ligne `@` du haut).
- Petites notes (`3'5`, dans la case de la note principale), d'une seule sorte.
- Ornements : trille (`5~7`, voisine écrite en clair), mordant et gruppetto écrits en petites notes, arpège (`/` sur la ligne `@` d'une partie, ou du haut pour toutes).
- Consignes de pédale (`Ped. simile`) sur la ligne de pédale.
- Liaisons d'expression (`(-----)` sur la ligne `@` de la partie), gravées en arcs sous ses lignes ; les liaisons de prolongation restent des tenues `-`.
- Doigtés (`5_3`, gravés en chiffre blanc sur une pastille sombre, en bas à droite de la note), avec une option pour les masquer.
- Premier découpage du temps noté `*` (gravé en astérisque) : le `:` ne sert plus qu'aux reprises.
- Sous-titre (`subtitle` dans le frontmatter), gravé sous le titre ; importé des textes de page du MusicXML.
- Version du format dans le frontmatter (`format: 1`) : un fichier d'une autre version est refusé en le disant.
- Notice (`NOTICE.md`) : lire en ymn en partant de la partition classique ; affichée dans l'application (bouton « Notice »), chaque exemple gravé sous son texte, et vérifiée par les tests.
- Couleur par octave (option de l'application) : une teinte pâle fixe par octave, palette arc-en-ciel ou feutrée, dans l'ordre ou dans un ordre mélangé (fixe) pour plus de contraste entre octaves voisines ; le numéro d'octave reste affiché.
- Accords d'accompagnement : ligne `@c`, en nom anglais (`Am`, `G/B`) ou en notes ymn de la basse vers l'aigu (`10;1;5`) ; gravés en nom, en notes empilées, ou les deux (option) ; importés de `<harmony>` ou d'un texte qui n'est qu'un nom d'accord.
- Paroles : une ligne `@l` par couplet sous la partie qui chante, une syllabe par case, `lu- ne` pour le trait d'union, `ne ---` pour un mélisme ; gravées sous les notes en caractères à empattements ; importées de `<lyric>`.
- Notes alignées (option de gravure « Notes : alignées ») : une note rejouée garde sa ligne d'un temps à l'autre, l'aiguë toujours au-dessus de la grave, avec le moins de lignes possible ; le fichier `.ymn` ne change pas.
- Plusieurs parties et instruments : autant de parties que voulu (une main, une voix, une flûte), séparées par un trait simple dans un instrument et double entre deux instruments ; noms déclarés dans `parts:` et écrits sur les traits ; une seule règle de comptage pour toutes ; pédale sous la dernière partie de son instrument ; accolade et noms à la gravure ; import de toutes les `<part>` du MusicXML, une partie par portée.
- Import : les indications d'octave (`8va`, `8vb`, `loco`…) sont ignorées, chaque note portant déjà son octave.

## À faire

Rien pour l'instant.

## Hors v1 pour l'instant

Articulations (staccato, accents…). Polymétrie (des parties dont les barres de mesure ne tombent pas au même endroit).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
