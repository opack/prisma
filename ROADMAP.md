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
- Articulations : `.` staccato, `!` accent, `!!` marcato, sur la ligne d'expression de la partie, pour tout ce qu'elle attaque dans la case ; gravées comme les signes classiques en haut à droite de la note ; importées du MusicXML (le tenuto, déjà dans la durée, est ignoré).
- Instruments transpositeurs : notés à la hauteur qui sonne, la hauteur écrite du MusicXML corrigée d'après `<transpose>`.
- Import : les indications d'octave (`8va`, `8vb`, `loco`…) sont ignorées, chaque note portant déjà son octave.
- Import : une nuance écrite en toutes lettres dans un texte (« sempre pianissimo ») reçoit aussi son signe (`pp`) ; le texte est gardé en entier. L'écoute ne lit que les signes.
- Écriture `.ymn` : un texte (« dolce », « sempre pianissimo… ») déborde sur les cases suivantes de sa ligne au lieu d'élargir sa case ; sa case ne s'élargit que s'il buterait sur l'indication suivante.
- Métronome, premier temps : un bouton à côté de la lecture le fait battre les temps, le premier de la mesure plus aigu (levées comprises), reprises et points d'orgue suivis ; un second bouton coupe les instruments pour n'entendre que le métronome ; les deux réglages gardés dans le navigateur ; les réglages du métronome dans la rubrique « Métronome » du panneau d'options ; le son est un coup de bloc de bois enregistré, inclus dans l'application (« Metronome.wav » de Druminfected sur freesound.org, licence CC0, raccourci à 90 ms), le premier temps joué plus haut.
- Métronome, divisions : chaque niveau (premier temps, temps, division du temps en 2 ou en 3 selon son découpage, subdivision en deux) a son son au choix, sur un curseur à cinq crans (aucun, grave, bois, aigu, très aigu) ; le métronome bat les cases écrites (par défaut : un coup par case, qui fait entendre quand jouer), ou les seules attaques (là où une note commence, temps compris : ni tenues ni silences), ou la grille régulière du temps ; les divisions plus discrètes que les temps.
- Écoute, premier temps : bouton « Écouter » qui joue les notes de toutes les parties avec un piano échantillonné (bibliothèque smplr, sons téléchargés au premier clic), curseur sur la case jouée et défilement qui remonte le système en haut de l'écran ; pause qui reprend sur la case surlignée, arrêt, tempo celui de `bpm` par défaut, modifiable même en cours de lecture et rétabli d'un clic.
- Écoute : un clic sur une colonne de la gravure y place le curseur, d'où la lecture démarre ou reprend (ou repart aussitôt si elle est en cours) ; les notes qui sonnent encore à cet endroit sont rejouées.
- Écoute : reprises (`||:`, `:||`, `3×`) et ordre des sections déroulés comme à la lecture ; le curseur suit chaque passage, et la lettre de la section jouée est entourée dans l'ordre de jeu en tête de page ; un clic dans une mesure jouée plusieurs fois reste dans le passage en cours, ou revient au plus récent ; un clic sur une lettre de l'ordre de jeu va droit à cette section.
- Écoute : nuances en intensité (de `ppp` à `fff`, mf par défaut), accents (`sf`, `sfz`, `fz`, `rfz`) sur la seule note attaquée, `fp` et `sfp` ; soufflets, `cresc.` et `dim.` menés jusqu'à la nuance suivante, ou d'une nuance sans elle ; chaque indication vaut pour tout l'instrument, sauf pour une partie qui a la sienne au même instant (une nuance par main écrite au même endroit).
- Écoute : pédale de résonance, pour toutes les parties de son instrument : une note relâchée sonne jusqu'à ce que la pédale remonte, un changement de pédale efface l'harmonie précédente, une touche rejouée arrête sa note tenue ; après « Ped. simile », le motif de la dernière mesure pédalée est reproduit à chaque mesure, jusqu'au prochain signe de pédale ou à la section suivante.
- Écoute : petites notes jouées brèves juste avant leur note, de gauche à droite dans la case, ensemble quand elles sont alignées.
- Écoute : trilles, la note et sa voisine alternées une douzaine de fois par seconde, en commençant et en finissant par la note.
- Écoute : arpèges égrenés à partir du temps, du grave à l'aigu (`/`) ou de l'aigu au grave (`\`), d'une partie ou de tout le système, les notes restant tenues.
- Écoute : point d'orgue, ce qui commence là (note, accord ou silence) tenu deux fois plus longtemps (deux temps de plus au plus), le curseur restant sur sa case.
- Gravure de « Ped. simile » (option) : les pédales qu'il demande, gravées comme les autres (par défaut), atténuées en gris clair, ou la seule mention ; le fichier garde la mention.
- Écoute : articulations, le staccato joué moitié moins long, l'accent plus fort, le marcato plus fort et un peu plus court ; la pédale peut encore tenir une note détachée.
- Écoute : boutons de lecture en icônes : début du morceau, section précédente (début de la section jouée, ou la section d'avant si l'on est dans sa première mesure ou au second clic rapproché), lecture et pause, section suivante, arrêt.

## À faire

1. **Métronome**, dernière itération : décompte d'une mesure avant le départ, en option, et volume du métronome par rapport aux instruments.
2. **Parties muettes à l'écoute** : rendre muette une partie ou un instrument (une main, une voix), pour s'entraîner à la jouer pendant que l'app joue les autres.
3. **Bouton engrenage** en haut à droite pour afficher ou masquer le panneau d'options ; le panneau, de plus en plus fourni, devra peut-être changer de forme.
4. **Mode lecture** : masquer le panneau d'édition pour jouer plutôt qu'éditer ; les pages de la gravure côte à côte, avec un défilement horizontal.
5. **Bibliothèque de partitions** (à concevoir) : retrouver et ouvrir ses morceaux depuis l'application.
6. **Timbre par instrument** à l'écoute (importé du MusicXML quand il l'indique, sinon choisi au moment de l'écoute, d'une façon à définir).

## Hors v1 pour l'instant

Polymétrie (des parties dont les barres de mesure ne tombent pas au même endroit).

## Limites connues

- Une mesure exclue du décompte au milieu du morceau (`implicit="yes"`, par exemple une mesure coupée autour d'une reprise) prend quand même un nouveau numéro : le format numérote les mesures d'un système à la suite.
