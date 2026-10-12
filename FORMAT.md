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
3. **Les lignes de la main droite.**
4. **Le trait entre les mains**, obligatoire, même quand une main ne joue pas.
5. **Les lignes de la main gauche.**

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

Une ou plusieurs lignes facultatives, **au-dessus** de la règle de comptage, qui commencent par `@`. Chaque indication commence exactement sur la colonne d'une case de la règle (le lecteur signale une erreur sinon), et peut déborder sur les cases suivantes. Deux indications sont séparées par au moins deux espaces. Les `|` et `:` recopiés pour se repérer sont ignorés.

| Indication | Sens |
|---|---|
| `[1.` `[2.` `[1.2.` | Ouvre une case de reprise (« 1.2. » : jouée aux passages 1 et 2). |
| `]` | Ferme la case en cours à la fin de cette mesure. |
| `3×` (ou `3x`) | Le passage se joue 3 fois. À placer dans la mesure qui se termine par `:||`. |
| autre texte | Indication pour tout le système : `rit.`, `a tempo`, `D.C.`, `Fine`… |

Une case se ferme sur `]`, ou sur la fin de reprise `:||` qu'elle contient. Sans l'une ni l'autre, elle s'arrête à la fin de sa première mesure. Pour éviter toute ambiguïté, l'import et `format` écrivent toujours le `]` d'une case qui ne se termine pas par `:||`.

```
@                                       [1.               [2.         ]
m1 ||:1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  :||1  |2  |3  |4  ||
───┼┼────┼───┼───┼───┼┼───┼───┼───┼───┼┼───┼───┼───┼────┼┼───┼───┼───┼───┼┼
0  ||:1  |3  |5  |8  ||5  |3  |1  |   ||3  |-  |-  |-  :||1  |-  |-  |-  ||
───┼┼────┼───┼───┼───┼┼───┼───┼───┼───┼┼───┼───┼───┼────┼┼───┼───┼───┼───┼┼
-1 ||:1  |-  |-  |-  ||8  |-  |-  |-  ||8  |-  |-  |-  :||1  |-  |-  |-  ||
```

## Hors format pour l'instant

Nuances et indications propres à une voix (ligne `@` sous chaque voix), pédale (ligne `Ped`), ornements, articulations.

## Outil en ligne de commande

```
npm run ymn -- import morceau.musicxml -o morceau.ymn --largeur 96
npm run ymn -- format morceau.ymn -o morceau.ymn --largeur 120
npm run ymn -- check morceau.ymn
```

`format` relit un fichier et le remet en page à la largeur demandée. `check` signale la première erreur, avec sa ligne et sa colonne.
