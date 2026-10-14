# Format .ymn — version 1

Un fichier `.ymn` est un texte brut en UTF-8, à lire et à écrire dans une police à chasse fixe. Il contient un frontmatter facultatif, puis des **systèmes** séparés par des lignes vides.

## Frontmatter

Entre deux lignes `---`, une clé par ligne, sous la forme `clé: valeur`.

| Clé | Rôle |
|---|---|
| `format` | Version du format ymn du fichier : `format: 1`. L'écriture la met toujours ; un fichier sans elle est lu comme la version courante. Le lecteur refuse un fichier d'une autre version en le disant (voir « Versions »). |
| `title`, `subtitle`, `composer`, `source` | Informations affichées : le sous-titre (« Op. 9 n° 2 », « Suite bergamasque, 3ᵉ mouvement »…) sous le titre. |
| `bpm` | Tempo de départ, en temps (*beats*) par minute : `bpm: 78`, gravé « 78 bpm ». Le temps est celui de la règle de comptage, donc la noire pointée d'un 6/8 : le nombre se lit sans ambiguïté, comme sur un métronome. Les indications en mots (`Andante`, `rit.`) vont sur la ligne `@` au-dessus de la règle. À l'import MusicXML, il vient du premier `<sound tempo>`, converti des noires en temps. |
| `order` | Ordre de jeu des sections, par leur lettre : `order: A A B C B D A` (voir « Sections et ordre de jeu »). |
| `cell` | Largeur de base d'une case en caractères, à l'écriture. Vaut 3 par défaut. |
| `division` | Découpage par défaut d'un temps : `2` (binaire, par défaut) ou `3` (ternaire, pour le 6/8 par exemple). |

Les clés sont en anglais. Les autres clés sont conservées telles quelles.

## Un système

```
m12|1  *  |2  |3  *  *  ||1  |2  |
───┼──────┼───┼─────────┼┼───┼───┼
+1 |3  5  |7  |8  7  5  ||3  |-  |
0  |   10 |-  |         ||   |   |
───┼──────┼───┼─────────┼┼───┼───┼
-1 |1  -  |-  |-  -  -  ||-  |   |
   |      |   |8        ||   |   |
```

1. **La règle de comptage** commence par `m` suivi du numéro de la première mesure. Chaque temps est encadré par des `|`, et une fin de mesure s'écrit `||`.
2. **Un trait sous la règle**, facultatif.
3. **Les lignes de la main droite**, suivies si besoin de ses lignes `@l` de paroles et `@` de nuances.
4. **Le trait entre les mains**, obligatoire, même quand une main ne joue pas.
5. **Les lignes de la main gauche**, suivies si besoin de ses lignes `@l` de paroles, `@` de nuances et de pédale.

Les traits s'écrivent avec `─`, `-`, `=`, `+` ou `┼`, sans espace.

### Les cases

Un temps est une suite de cases, toutes de même durée. Sur la règle de comptage, **chaque case commence par son étiquette** et va jusqu'à l'étiquette suivante :

| Étiquette | Sens |
|---|---|
| chiffre | Début du temps, avec son numéro, collé à la barre qui le précède. |
| `*` | Premier découpage du temps : un `*` coupe en 2, deux `*` coupent en 3. |
| `.` | Second découpage : chaque morceau recoupé en 2. |
| `,` | Découpage plus fin. |

Un temps de 4 cases s'écrit `1  .  *  .  `, un temps de 8 cases `1  ,  .  ,  *  ,  .  ,  `.

Le `:` ne sert qu'aux reprises (`||:`, `:||`) : un signe, un seul sens.

La largeur d'une case est libre : seul son nombre compte pour le temps. L'écriture leur donne la largeur `cell`, et élargit une case quand une indication posée dessus ne tient pas (`(mp)`, `cresc.`…) : `1      *  ` est un temps de deux cases dont la première est élargie. À la main, on ajoute simplement des espaces là où il faut de la place. La gravure, elle, garde des temps de largeur égale, et marque chaque case comme les graduations d'une règle, posées sur son trait du bas : comme dans le texte : un astérisque pour `*`, un point pour `.` et une virgule pour `,`.

Sur les lignes de notes :

| Contenu | Sens |
|---|---|
| `1` à `12` | Attaque d'une note (1 = do, 12 = si). |
| `-` | La note continue. |
| `-7` | En début de système : le 7 commencé plus tôt continue. |
| vide | Rien ne sonne sur cette ligne. |
| `5~7` | Trille : le 5 alterne avec le 7 pendant toute sa durée (voir « Ornements »). |
| `5_3` | Doigté : le 5 se joue avec le doigt 3 (1 = pouce, 5 = auriculaire). Se combine : `5~7_2`. |
| `3'` | Petite note, devant le contenu de la case (voir « Petites notes »). |

Une note s'arrête au premier ancrage vide de sa ligne. Une note répétée se réécrit.

### Petites notes

Une petite note (appoggiature, acciaccature) se joue très vite, juste avant la note de sa case, sans compter dans le temps. Elle s'écrit avec son numéro suivi d'une apostrophe, **dans la case de la note principale**, sur la ligne de son octave : `3'5` joue un 3 bref, puis le 5 sur le temps.

```
m1 |1        |2  |
+1 |3'       |   |
0  |  7'9'5  |-  |
```

- Plusieurs petites notes s'enchaînent : `7'9'5`. L'apostrophe sépare aussi les numéros à deux chiffres : `10'12'7`.
- Elles se jouent de gauche à droite à l'intérieur de la case, quelle que soit leur ligne : ici 3 (octave du dessus), 7, 9, puis le 5. Deux petites notes alignées sur la même colonne se jouent ensemble.
- Une petite note seule sur sa ligne n'y fait rien sonner ensuite : `3'` puis rien, c'est juste la petite note.
- À l'écriture, le contenu des cases vient après les petites notes, sur toutes les lignes, pour que les notes jouées ensemble restent alignées.
- La gravure les dessine en petit, en exposant et en gris foncé, en tête de case.

Une seule sorte de petite note : barrée ou non, c'est au pianiste de la placer, comme sur une partition classique.

### Doigtés

Le doigt suit la note dans sa case, après `_` : `5_3`. Chaque note d'un accord porte le sien, sur sa ligne. `'` et `_` vont par paire : la petite note est gravée en exposant, devant la note ; le doigt en indice, en bas à droite de la note, en chiffre blanc sur une pastille sombre : une forme qu'aucune note ne peut imiter, et qui s'imprime en noir et blanc. Le doigt se pose sur l'attaque, jamais sur une tenue. L'application peut masquer les doigtés, sans toucher au fichier. À l'import, une substitution (« 4-3 » : changer de doigt sur une note tenue) garde le premier doigt.

### Ornements

Un signe d'ornement classique ne dit pas quelles notes jouer : il faut l'armure, ou une petite altération dessinée sur le signe, pour connaître la note voisine. Ici, les notes sont écrites en clair.

- **Trille** : la note, `~`, puis sa voisine, dans la case de la note : `5~7` alterne 5 et 7 pendant toute la durée de la note, prolongée par des `-` comme d'habitude. La voisine est la plus proche qui porte ce numéro : `12~1` alterne le si et le do juste au-dessus. La gravure écrit la voisine en petit après la note, puis un trait ondulé sur toute sa durée.
- **Mordant et gruppetto** : écrits en petites notes, puisque leurs notes sont fixées par la convention. En do majeur, mordant sur 5 (mi) avec la voisine du dessus : `5'6'5` ; avec celle du dessous : `5'3'5`. Gruppetto sur 5 : `6'5'3'5` (dessus, note, dessous, note). Un gruppetto placé après une note se joue juste avant la note suivante : ses petites notes vont dans la case de celle-ci.
- **Arpège** : voir « Ligne d'indications `@` » et « Nuances et soufflets ». Le signe `/` (`\` de l'aigu au grave) se pose sur la case de l'accord ; les notes égrenées restent tenues.

L'import calcule les voisines d'après l'armure, les altérations déjà posées dans la mesure et celles dessinées sur l'ornement.

### Les lignes

- À gauche du premier `|`, l'octave, **comptée depuis celle du do central** : `0` pour l'octave qui commence au do central, `+1` pour celle du dessus, `-1` pour celle du dessous, et ainsi de suite (un piano de 88 touches va de `-4` à `+4`). Le rendu graphique les affiche avec des flèches (↑1, ↓1). On ne l'écrit que sur la première ligne d'un groupe : les lignes suivantes sans numéro appartiennent à la même octave.
- Cette référence ne dépend d'aucune convention nationale : le do central s'appelle do3 en France et C4 dans la notation internationale, mais c'est la même touche.
- Une ligne ne porte jamais deux notes en même temps. Un accord occupe une ligne par note.
- Tous les `|` d'une ligne sont alignés sur ceux de la règle. Les espaces en fin de ligne peuvent être omis.

### Les sauts de ligne

Ils sont libres : on peut écrire une mesure par système ou couper une mesure entre deux temps. Un système qui reprend une mesure inachevée commence par le même numéro et par le temps suivant (`m12|3 …`).

Une anacrouse commence directement au temps voulu : `m0|3  ||` pour un levé d'un temps en 3/4.

Les lignes qui commencent par `#` sont des commentaires.

## Reprises

Les signes de reprise remplacent une barre de mesure, sur la règle de comptage **et** sur chaque ligne de notes :

| Signe | Sens |
|---|---|
| `||:` | Un passage répété commence à la mesure suivante. En tête de système, il s'écrit directement après la colonne de gauche : `m5 ||:1 …`. |
| `:||` | Le passage répété se termine ici : on revient au dernier `||:`, ou au début de la section. |
| `:||:` | Une reprise se termine et la suivante commence. |

Sur les lignes de notes, les deux points peuvent être remplacés par une espace, mais la colonne doit être conservée : les barres restent alignées sur la règle.

Une reprise reste simple et locale : elle ne passe jamais le début d'une section. Les cases 1. et 2., les D.C., D.S., segno, coda et Fine n'existent pas dans le format : on les écrit avec des sections et un ordre de jeu.

## Ligne d'indications `@`

Une ou plusieurs lignes facultatives, **au-dessus** de la règle de comptage, qui commencent par `@`. Chaque indication est alignée sur une colonne de la règle (le lecteur signale une erreur sinon), et peut déborder sur les colonnes suivantes. Deux mots séparés par une seule espace forment un seul texte (`a tempo`, `più f`, `Ped. simile`) : deux indications distinctes sont séparées par au moins deux espaces. Seuls les signes restent à part même à une espace de leur voisin : un soufflet, un signe de pédale placé après un texte, un début de section `*A`, un point d'orgue `^`, un arpège `/`. Les `|` et `:` recopiés pour se repérer sont ignorés.

| Indication | Placée sur | Sens |
|---|---|---|
| `3×` (ou `3x`) | une case de la mesure qui se termine par `:||` | Le passage se joue 3 fois. |
| `*A` | le **dernier** `|` de la barre qui ouvre la mesure | Début de la section A (voir « Sections et ordre de jeu »). |
| `^` | une case | Point d'orgue : la note, l'accord ou le silence qui commence là se tient plus longtemps que sa valeur, à l'appréciation du pianiste. Gravé 𝄐 au-dessus de la case. |
| `/` | une case | Arpège des deux mains, d'un seul geste : de la note la plus grave de la main gauche à la plus aiguë de la main droite. `\` : de l'aigu au grave. Gravé comme une vaguelette verticale devant l'accord. |
| autre texte | une case | Indication pour tout le système : `rit.`, `a tempo`… (les nuances d'une main vont sous ses lignes, voir plus bas) |

Pour la première mesure d'un système, `*A` se place sur le `|` de la colonne de gauche (ou sur celui de `|:` quand le système commence par une reprise).

## Accords : ligne `@c`

Une ligne qui commence par `@c` (*chords*), **au-dessus** de la règle de comptage (avec les autres lignes `@` du haut), porte les accords d'accompagnement. Chaque mot est un accord, qui commence exactement sur sa case ; contrairement aux autres lignes `@`, deux mots voisins sont toujours deux accords.

Un accord s'écrit de deux façons :

| Écriture | Exemple | Sens |
|---|---|---|
| nom anglais | `Am`, `G7`, `Cmaj7`, `F#m7b5`, `Bb`, `Dsus4`, `C6/9`, `G/B` | la fondamentale (`A` à `G`, suivie de `#` ou `b`), la qualité, puis `/` et la basse si elle diffère |
| notes ymn | `10;1;5`, `12;3;8` | les notes séparées par `;`, **de la basse vers l'aigu**, sans octave |

Qualités reconnues : `` (majeur), `m`, `dim`, `aug`, `sus2`, `sus4`, `5`, `6`, `m6`, `7`, `maj7`, `m7`, `mMaj7`, `dim7`, `m7b5`, `aug7`, `7sus4`, `7b5`, `add9`, `madd9`, `6/9`, `9`, `maj9`, `m9`, `7b9`, `7#9`, `11`, `m11`, `13`, `maj13`, `m13` (et leurs variantes usuelles : `min`, `-`, `M7`, `Δ`, `°`, `ø`, `+`). Un accord inconnu est une erreur.

L'ordre des notes ymn compte : `Am7` (`10;1;5;8`) et `C6` (`1;5;8;10`) ont les mêmes notes, seule la basse les distingue. Le fichier garde l'écriture choisie ; la gravure affiche le nom, les notes empilées (la basse en bas), ou les deux, en calculant l'un à partir de l'autre. À l'import MusicXML, les accords viennent de `<harmony>`, ou d'un simple texte dont tout le contenu est un nom d'accord (`A7` écrit au-dessus de la portée).

## Sections et ordre de jeu

Un morceau qui ne se joue pas d'un bout à l'autre se découpe en **sections**, et un **ordre de jeu** les enchaîne, comme les couplets et le refrain d'une chanson. Ce mécanisme unique remplace les cases 1. et 2., D.C., D.S., segno, coda, To Coda et Fine : on joue les sections dans l'ordre de la liste, et le morceau s'arrête quand la liste est finie. Il n'y a rien à retenir en jouant.

- `*A` sur la ligne `@` du haut marque le début de la section A. Une section va jusqu'au début de la suivante (ou jusqu'à la fin du morceau). La première section commence à la première mesure.
- `order: A B A C` dans le frontmatter donne l'ordre de jeu. Sans `order`, les sections se jouent l'une après l'autre.
- Le lecteur signale une section posée deux fois, un ordre qui nomme une section absente, un morceau qui commence avant sa première section, et une reprise à cheval sur deux sections.

Chaque section commence un nouveau système, dans le texte comme à la gravure, à la manière des couplets et du refrain d'une chanson ; la précédente se termine par une double barre. À la gravure, la section porte sa lettre en blanc sur fond noir, un peu d'espace la sépare de la précédente, et l'ordre de jeu est gravé avec les mêmes lettres en tête de chaque page.

Un morceau en quatre mesures, A (mesures 1 et 2), B (3) et C (4), joué A, B, A puis C : l'équivalent d'une reprise à deux cases.

```
---
order: A B A C
---

@  *A
m1 |1  |2  ||1  |2  ||
───┼───┼───┼┼───┼───┼┼
0  |1  |3  ||5  |3  ||
───┼───┼───┼┼───┼───┼┼
-1 |1  |   ||8  |   ||

@  *B
m3 |1  |2  ||
───┼───┼───┼┼
0  |8  |   ||
───┼───┼───┼┼
-1 |5  |   ||

@  *C
m4 |1  |2  ||
───┼───┼───┼┼
0  |1  |   ||
───┼───┼───┼┼
-1 |1  |   ||
```

À l'import MusicXML, le morceau est déroulé (reprises, cases, D.C., D.S., To Coda, Fine ; après un D.C. ou un D.S., sans refaire les reprises et en prenant la dernière case), puis découpé en sections partout où l'ordre de jeu saute. Une section toujours jouée deux fois de suite redevient une reprise simple, et deux sections toujours jouées l'une après l'autre sont réunies : un morceau qui n'a que des reprises simples n'a pas de section.

## Nuances et soufflets : lignes `@` sous chaque main

Une ou plusieurs lignes `@` placées **sous les lignes d'une main** portent ses nuances : juste au-dessus du trait entre les mains pour la main droite, à la fin du système pour la main gauche. Aucune ligne de notes de cette main ne peut les suivre. Comme au-dessus de la règle, chaque indication commence exactement sur une case, et deux indications sont séparées par au moins deux espaces.

| Indication | Sens |
|---|---|
| `ppp` `pp` `p` `mp` `mf` `f` `ff` `fff` `sf` `sfz` `sfp` `fp` `fz` `rfz` | Nuance, gravée en gras italique. Entre parenthèses (`(mp)`), c'est une nuance ajoutée par l'éditeur. |
| `<----` | Crescendo, de sa première case à la case qui contient son dernier caractère. |
| `>----` | Decrescendo, de même. |
| `(-----)` | Liaison d'expression : de la note de la case du `(` à celle de la case du `)`, jouées liées. |
| `/` | Arpège de l'accord de cette main, du grave à l'aigu (`\` : de l'aigu au grave). |
| autre texte | Indication pour cette main : `cresc.`, `dim.`, `dolce`, `sempre legato`, `più f`… |

Une liaison relie des notes différentes, à jouer liées (legato), et dessine les phrases. Ce n'est pas la liaison de prolongation entre deux notes identiques : celle-là n'existe pas ici, la note se tient avec `-`. Comme un soufflet, une liaison coupée par un changement de système s'écrit `(-----` en fin de système et `-----)` au début du suivant (`------` pour un système qu'elle traverse tout entier). Les liaisons imbriquées ou qui se chevauchent vont chacune sur sa ligne `@` ; quand plusieurs liaisons d'une main continuent au système suivant, leurs suites s'écrivent de haut en bas dans l'ordre où elles ont commencé. La gravure les trace comme des arcs fins dans une bande juste sous les lignes de la main, la plus courte au plus près des notes.

Un soufflet est toujours lu à part : une seule espace suffit entre lui et sa voisine. Il peut commencer dans la case d'une nuance, juste après elle : `p <----` part de la case du `p`. Il peut traverser les barres (avec des `-` ou des `|`). Coupé par un changement de système, il se réécrit au début du système suivant et se lit comme un seul soufflet ; la gravure le laisse ouvert au point de coupure.

```
m1 |1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
0  |5  |7  |8  ||10 |8  |7  ||5  |-  |3  ||1  |-  |-  ||
@   p   <------------------   mf  >------------------
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
-1 |1  |-  |-  ||8  |-  |-  ||6  |-  |-  ||1  |-  |-  ||
@   pp           sempre legato
```

À l'import MusicXML, nuances, soufflets et textes suivent leur portée ; les indications de tempo et de structure (`rit.`, `a tempo`, `Andante`…) vont sur la ligne `@` au-dessus de la règle. Chaque indication est calée sur l'attaque ou le début de temps le plus proche. Les notes sont calées sur une grille de 48 cases par temps (doubles croches et triolets de doubles croches) : une durée plus fine, comme un quintolet, prend la case la plus proche.

## Paroles : lignes `@l` sous une main

Une ligne qui commence par `@l` (*lyrics*), **sous les lignes d'une main** avec ses autres lignes `@`, porte un couplet de paroles. Plusieurs lignes `@l` sous une même main sont les couplets 1, 2… de haut en bas ; une ligne `@l` vide garde la place d'un couplet absent de ce système. L'écriture place les paroles juste sous les notes, avant les nuances.

Comme sur la ligne `@c`, chaque mot est à part : une seule espace sépare deux syllabes. Chaque syllabe commence exactement sur une case, normalement celle de sa note. Une espace insécable reste dans la syllabe (`Oh !`), et deux syllabes chantées sur une même note s'écrivent liées par `‿` (`qu'on‿a`).

| Écriture | Sens |
|---|---|
| `lune` | Une syllabe, qui finit son mot. |
| `lu-` | Une syllabe suivie d'un trait d'union : le mot continue sur la syllabe suivante. |
| `ne ---` | Prolongation (mélisme) : la syllabe se chante sur les notes suivantes, jusqu'à la fin de la case qui contient le dernier `-`. Comme une tenue de note, et comme un soufflet pour sa longueur. |

La prolongation suit sa syllabe, après au moins une espace, et doit dépasser la case de la syllabe ; une syllabe suivie d'un trait d'union ne se prolonge pas (le trait d'union mène déjà à la suivante). Coupée par un changement de système, elle reprend au début du suivant par `---` sur la ligne du même couplet. Les `|` recopiés dans une prolongation (`----|---`) sont ignorés.

La gravure écrit les paroles en caractères droits à empattements, pour ne pas les confondre avec les chiffres des notes, sous le début de chaque note ; le trait d'union se place entre les deux syllabes, la prolongation est un trait bas jusqu'à la fin de la dernière note. Une syllabe trop longue élargit sa case.

À l'import MusicXML, chaque `<lyric>` donne une syllabe, sous la main de sa portée ; les couplets suivent l'ordre de leur numéro (`number`). `<syllabic>` `begin` ou `middle` donne le trait d'union ; `<extend>` une prolongation jusqu'à la fin de la dernière note de la voix avant la syllabe suivante du couplet, si elle couvre plusieurs notes.

## Pédale

La pédale de résonance se note sur une ligne `@` **sous la main gauche**, avec trois signes posés sur les cases :

| Signe | Sens |
|---|---|
| `Ped.` | Enfoncer la pédale. |
| `*` | La relâcher. |
| `*Ped.` | La changer : relâcher et enfoncer au même instant. |

Une consigne qui commence par `Ped.` (`Ped. simile` : « continue à pédaler de même », `Ped. sempre`…) se place sur la même ligne : c'est un texte, pas un signe, qui se lit dans la continuité du trait de pédale.

Une pédale enfoncée le reste d'un système au suivant sans rien réécrire. Sans `*`, elle tient jusqu'à la fin du morceau. La remise en page écrit la pédale sur sa propre ligne, tout en bas du système ; la gravure la trace comme un trait sous le système, dont la longueur montre exactement ce qui est tenu, avec une pointe à chaque changement.

```
m1 |1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
0  |5  |7  |8  ||10 |8  |7  ||5  |-  |3  ||1  |-  |-  ||
@   p   <------------------   mf  >------------------
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
-1 |1  |-  |-  ||8  |-  |-  ||6  |-  |-  ||1  |-  |-  ||
@   pp           sempre legato
@   Ped.         *Ped.        *Ped.                *
```

## Hors format pour l'instant

Articulations. Voir ROADMAP.md.

## Versions

La version change à chaque modification qui rend un ancien fichier illisible.

| Version | Changement |
|---|---|
| 1 | Le premier découpage du temps s'écrit `*` (auparavant `:`, désormais réservé aux reprises). Ajout de la clé `format`. |

## Outil en ligne de commande

```
npm run ymn -- import morceau.musicxml -o morceau.ymn --largeur 96
npm run ymn -- format morceau.ymn -o morceau.ymn --largeur 120
npm run ymn -- check morceau.ymn
```

`format` relit un fichier et le remet en page à la largeur demandée. `check` signale la première erreur, avec sa ligne et sa colonne.
