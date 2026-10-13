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
- Import : les indications d'octave (`8va`, `8vb`, `loco`…) sont ignorées, chaque note portant déjà son octave.

## À faire

1. **Couleur par octave** (à discuter une fois le reste fait) : chaque couloir d'octave sur un fond de couleur pâle, **la même pour une octave donnée dans tous les morceaux**, pour apprendre à situer les octaves (et pouvoir coller des pastilles de la même couleur sur le clavier). Pistes :
   - ordre de l'arc-en-ciel, du grave à l'aigu (violet, bleu, vert, jaune, orange, rouge…), pour qu'une couleur dise aussi « plus haut » ou « plus bas » ;
   - 9 couloirs sur un piano (`-4` à `+4`) : couleurs en plus, ou gris pour les extrêmes, rares ;
   - option à activer ou non (impression en noir et blanc, daltonisme) ; le numéro d'octave reste dans l'onglet, la couleur ne porte jamais seule l'information.

2. **Plusieurs parties** (à concevoir) : aujourd'hui, une partition a exactement deux parties, séparées par le trait épais (au piano, la main droite et la main gauche ; dans le code, encore « D » et « G »). Il en faudrait autant que voulu : un chant au-dessus du piano, un duo, un ensemble. Reste à concevoir :
   - **Écriture `.ymn`** : un trait par séparation, et un nom pour chaque partie (« Chant », « Piano »…), peut-être dans la colonne de gauche ou sur le trait ;
   - **Ce qui reste propre au piano** : la pédale (sous la dernière partie d'un piano), les accolades qui réunissent les deux mains ;
   - **Import MusicXML** : une partie par `<part>`, et par portée pour un instrument à deux portées ;
   - **Vocabulaire** : parler de parties partout (code, FORMAT.md), « main » restant un cas particulier.
3. **Paroles** (à concevoir, après les parties) : une syllabe par note, sous la partie chantée, sur une ligne `@` réservée aux paroles. Chaque syllabe commence sur la case de sa note ; une syllabe qui se prolonge sur plusieurs notes (mélisme) garde un trait. Il faut une règle à part : sur les autres lignes `@`, deux mots séparés par une seule espace forment un seul texte, alors que deux syllabes voisines sont deux indications. Le MusicXML les fournit (`<lyric>` : `<syllabic>`, `<text>`, `<extend>`).

## Hors v1 pour l'instant

Articulations (staccato, accents…).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
