# Feuille de route v1

## Fait

- Import MusicXML, format `.ymn` (lecture, écriture, remise en page), application de gravure A4.
- Reprises simples (`||:`, `:||`, `3×`).
- Nuances et soufflets, par main (lignes `@` sous chaque main).
- Pédale (`Ped.`, `*`, `*Ped.` sous la main gauche), tracée comme un trait sous le système.
- Sections et ordre de jeu (`*A`, `order: A A B C`), à la place des cases, D.C., D.S., segno, coda, To Coda et Fine.
- Point d'orgue (`^` sur la ligne `@` du haut).
- Petites notes (`3'5`, dans la case de la note principale), d'une seule sorte.
- Ornements : trille (`5~7`, voisine écrite en clair), mordant et gruppetto écrits en petites notes, arpège (`/` sur la ligne `@` d'une main, ou du haut pour les deux mains).
- Consignes de pédale (`Ped. simile`) sur la ligne de pédale.
- Liaisons d'expression (`(-----)` sur la ligne `@` de la main), gravées en arcs sous ses lignes ; les liaisons de prolongation restent des tenues `-`.
- Doigtés (`5_3`, gravés en chiffre blanc sur une pastille sombre, en bas à droite de la note), avec une option pour les masquer.
- Premier découpage du temps noté `*` (gravé en astérisque) : le `:` ne sert plus qu'aux reprises.
- Sous-titre (`subtitle` dans le frontmatter), gravé sous le titre ; importé des textes de page du MusicXML.
- Version du format dans le frontmatter (`format: 1`) : un fichier d'une autre version est refusé en le disant.
- Notice (`NOTICE.md`) : lire en ymn en partant de la partition classique ; affichée dans l'application (bouton « Notice »), chaque exemple gravé sous son texte, et vérifiée par les tests.
- Couleur par octave (option de l'application) : une teinte pâle fixe par octave, palette arc-en-ciel ou feutrée, dans l'ordre ou dans un ordre mélangé (fixe) pour plus de contraste entre octaves voisines ; le numéro d'octave reste affiché.
- Accords d'accompagnement : ligne `@c`, en nom anglais (`Am`, `G/B`) ou en notes ymn de la basse vers l'aigu (`10;1;5`) ; gravés en nom, en notes empilées, ou les deux (option) ; importés de `<harmony>` ou d'un texte qui n'est qu'un nom d'accord.
- Paroles : une ligne `@l` par couplet sous la main qui chante, une syllabe par case, `lu- ne` pour le trait d'union, `ne ---` pour un mélisme ; gravées sous les notes en caractères à empattements ; importées de `<lyric>`.
- Import : les indications d'octave (`8va`, `8vb`, `loco`…) sont ignorées, chaque note portant déjà son octave.

## À faire

1. **Aligner les notes qui se suivent** (option de gravure) : dans chaque octave, une note tenue ou rejouée garde sa rangée d'un temps à l'autre, pour que l'œil suive une note répétée ou une voix qui avance. Dans une case, les notes restent rangées de l'aigu vers le grave ; seule leur place verticale change, en laissant des rangées vides au besoin. Le calcul regarde la suite du morceau (chaînes de notes identiques d'un temps à l'autre) et garde le moins de rangées possible. Ne touche pas au fichier `.ymn` : seulement l'aperçu, l'impression et les exemples de la notice.
2. **Plusieurs parties** (à concevoir) : aujourd'hui, une partition a exactement deux parties, séparées par le trait épais (au piano, la main droite et la main gauche ; dans le code, encore « D » et « G »). Il en faudrait autant que voulu : un chant au-dessus du piano, un duo, un ensemble. Reste à concevoir :
   - **Écriture `.ymn`** : un trait par séparation, et un nom pour chaque partie (« Chant », « Piano »…), peut-être dans la colonne de gauche ou sur le trait ;
   - **Ce qui reste propre au piano** : la pédale (sous la dernière partie d'un piano), les accolades qui réunissent les deux mains ; les paroles (`@l`) suivent leur partie ;
   - **Import MusicXML** : une partie par `<part>`, et par portée pour un instrument à deux portées ;
   - **Vocabulaire** : parler de parties partout (code, FORMAT.md), « main » restant un cas particulier.

## Hors v1 pour l'instant

Articulations (staccato, accents…).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
