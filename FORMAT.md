# Format .ymn — version 0

Un fichier `.ymn` est un texte brut en UTF-8, à lire et à écrire dans une police à chasse fixe. Il contient un frontmatter facultatif, puis des **systèmes** séparés par des lignes vides.

## Frontmatter

Entre deux lignes `---`, une clé par ligne, sous la forme `clé: valeur`.

| Clé | Rôle |
|---|---|
| `title`, `composer`, `tempo`, `source` | Informations affichées. |
| `cell` | Largeur d'une case en caractères. Vaut 3 par défaut. |
| `division` | Découpage par défaut d'un temps : `2` (binaire, par défaut) ou `3` (ternaire, pour le 6/8 par exemple). |

Les clés sont en anglais. Les autres clés sont conservées telles quelles.

## Un système

```
m12|1  :  |2  |3  :  :  ||1  |2  |
───┼──────┼───┼─────────┼┼───┼───┼
+1 |3  5  |7  |8  7  5  ||3  |-  |
0  |   10 |-  |         ||   |   |
───┼──────┼───┼─────────┼┼───┼───┼
-1 |1  -  |-  |-  -  -  ||-  |   |
   |      |   |8        ||   |   |
```

1. **La règle de comptage** commence par `m` suivi du numéro de la première mesure. Chaque temps est encadré par des `|`, et une fin de mesure s'écrit `||`.
2. **Un trait sous la règle**, facultatif.
3. **Les lignes de la main droite**, suivies si besoin de ses lignes `@` de nuances.
4. **Le trait entre les mains**, obligatoire, même quand une main ne joue pas.
5. **Les lignes de la main gauche**, suivies si besoin de ses lignes `@` de nuances et de pédale.

Les traits s'écrivent avec `─`, `-`, `=`, `+` ou `┼`, sans espace.

### Les cases

Un temps est une suite de cases de largeur fixe (`cell`, 3 par défaut). Un temps de 12 caractères contient donc 4 ancres.

Sur la règle de comptage :

| Contenu | Sens |
|---|---|
| chiffre | Début du temps, avec son numéro. Il est obligatoire dans la première case de chaque temps. |
| `:` | Premier découpage du temps : un `:` coupe en 2, deux `:` coupent en 3. |
| `.` | Second découpage : chaque morceau recoupé en 2. |
| vide | Découpage plus fin. |

Sur les lignes de notes :

| Contenu | Sens |
|---|---|
| `1` à `12` | Attaque d'une note (1 = do, 12 = si). |
| `-` | La note continue. |
| `-7` | En début de système : le 7 commencé plus tôt continue. |
| vide | Rien ne sonne sur cette ligne. |

Une note s'arrête au premier ancrage vide de sa ligne. Une note répétée se réécrit.

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
| `:||` | Le passage répété se termine ici : on revient au dernier `||:`, ou au début du morceau. |
| `:||:` | Une reprise se termine et la suivante commence. |

Sur les lignes de notes, les deux points peuvent être remplacés par une espace, mais la colonne doit être conservée : les barres restent alignées sur la règle.

## Ligne d'indications `@`

Une ou plusieurs lignes facultatives, **au-dessus** de la règle de comptage, qui commencent par `@`. Chaque indication est alignée sur une colonne de la règle (le lecteur signale une erreur sinon), et peut déborder sur les colonnes suivantes. Deux indications sont séparées par au moins deux espaces. Les `|` et `:` recopiés pour se repérer sont ignorés.

| Indication | Placée sur | Sens |
|---|---|---|
| `[1.` `[2.` `[1.2.` | le **dernier** `|` de la barre qui ouvre la mesure | Ouvre une case de reprise (« 1.2. » : jouée aux passages 1 et 2). |
| `]` | le **premier** `|` de la barre qui ferme la mesure | Ferme la case en cours à cette barre. |
| `3×` (ou `3x`) | une case de la mesure qui se termine par `:||` | Le passage se joue 3 fois. |
| autre texte | une case | Indication pour tout le système : `rit.`, `a tempo`, `D.C.`, `Fine`… (les nuances d'une main vont sous ses lignes, voir plus bas) |

Sur une barre `||`, une case qui se ferme et la suivante qui s'ouvre s'écrivent donc à la suite : `][2.`. Pour la première mesure d'un système, `[` se place sur le `|` de la colonne de gauche (ou sur celui de `|:` quand le système commence par une reprise).

Une case se poursuit jusqu'à son `]`, ou jusqu'à la fin de reprise `:||` qu'elle contient. Sans l'une ni l'autre, elle va jusqu'à la case suivante, jusqu'au `||:` suivant, ou jusqu'à la fin du morceau. Dans ce dernier cas, comme sur une partition, son crochet n'est tracé qu'au-dessus de sa première mesure, ouvert à droite (il est fermé si cette mesure termine le morceau).

```
@                                      [1.               [2.             ]
m1 ||:1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  :||1  |2  |3  |4  ||1  |2  |3  |4  ||
───┼┼────┼───┼───┼───┼┼───┼───┼───┼───┼┼───┼───┼───┼────┼┼───┼───┼───┼───┼┼───┼───┼───┼───┼┼
0  ||:1  |3  |5  |8  ||5  |3  |1  |   ||3  |-  |-  |-  :||1  |-  |-  |-  ||5  |-  |-  |-  ||
───┼┼────┼───┼───┼───┼┼───┼───┼───┼───┼┼───┼───┼───┼────┼┼───┼───┼───┼───┼┼───┼───┼───┼───┼┼
-1 ||:1  |-  |-  |-  ||8  |-  |-  |-  ||8  |-  |-  |-  :||1  |-  |-  |-  ||1  |-  |-  |-  ||
```

## Nuances et soufflets : lignes `@` sous chaque main

Une ou plusieurs lignes `@` placées **sous les lignes d'une main** portent ses nuances : juste au-dessus du trait entre les mains pour la main droite, à la fin du système pour la main gauche. Aucune ligne de notes de cette main ne peut les suivre. Comme au-dessus de la règle, chaque indication commence exactement sur une case, et deux indications sont séparées par au moins deux espaces.

| Indication | Sens |
|---|---|
| `ppp` `pp` `p` `mp` `mf` `f` `ff` `fff` `sf` `sfz` `sfp` `fp` `fz` `rfz` | Nuance, gravée en gras italique. |
| `<----` | Crescendo, de sa première case à la case qui contient son dernier caractère. |
| `>----` | Decrescendo, de même. |
| autre texte | Indication pour cette main : `cresc.`, `dim.`, `dolce`, `sempre legato`, `più f`… |

Un soufflet est toujours lu à part : une seule espace suffit entre lui et sa voisine. Il peut traverser les barres (avec des `-` ou des `|`). Coupé par un changement de système, il se réécrit au début du système suivant et se lit comme un seul soufflet ; la gravure le laisse ouvert au point de coupure.

```
m1 |1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||1  |2  |3  ||
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
0  |5  |7  |8  ||10 |8  |7  ||5  |-  |3  ||1  |-  |-  ||
@   p   <------------------   mf  >------------------
───┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼───┼───┼───┼┼
-1 |1  |-  |-  ||8  |-  |-  ||6  |-  |-  ||1  |-  |-  ||
@   pp           sempre legato
```

À l'import MusicXML, nuances, soufflets et textes suivent leur portée ; les indications de tempo et de structure (`rit.`, `a tempo`, `D.C.`, `Fine`, `Coda`, `Andante`…) vont sur la ligne `@` au-dessus de la règle. Chaque indication est calée sur l'attaque ou le début de temps le plus proche.

## Pédale

La pédale de résonance se note sur une ligne `@` **sous la main gauche**, avec trois signes posés sur les cases :

| Signe | Sens |
|---|---|
| `Ped.` | Enfoncer la pédale. |
| `*` | La relâcher. |
| `*Ped.` | La changer : relâcher et enfoncer au même instant. |

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

Repères et sauts, point d'orgue, petites notes, ornements, liaisons d'expression, doigtés, articulations. Voir ROADMAP.md.

## Outil en ligne de commande

```
npm run ymn -- import morceau.musicxml -o morceau.ymn --largeur 96
npm run ymn -- format morceau.ymn -o morceau.ymn --largeur 120
npm run ymn -- check morceau.ymn
```

`format` relit un fichier et le remet en page à la largeur demandée. `check` signale la première erreur, avec sa ligne et sa colonne.
