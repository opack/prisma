# Format .ymn — version 0

Un fichier `.ymn` est un texte brut en UTF-8, à lire et à écrire dans une police à chasse fixe. Il contient un frontmatter facultatif, puis des **systèmes** séparés par des lignes vides.

## Frontmatter

Entre deux lignes `---`, une clé par ligne, sous la forme `clé: valeur`.

| Clé | Rôle |
|---|---|
| `titre`, `compositeur`, `tempo`, `source` | Informations affichées. |
| `case` | Largeur d'une case en caractères. Vaut 3 par défaut. |
| `division` | Découpage par défaut d'un temps : `2` (binaire, par défaut) ou `3` (ternaire, pour le 6/8 par exemple). |

Les autres clés sont conservées telles quelles.

## Un système

```
m12|1  :  |2  |3  :  :  ||1  |2  |
───┼──────┼───┼─────────┼┼───┼───┼
5  |3  5  |7  |8  7  5  ||3  |-  |
4  |   10 |-  |         ||   |   |
───┼──────┼───┼─────────┼┼───┼───┼
3  |1  -  |-  |-  -  -  ||-  |   |
   |      |   |8        ||   |   |
```

1. **La règle de comptage** commence par `m` suivi du numéro de la première mesure. Chaque temps est encadré par des `|`, et une fin de mesure s'écrit `||`.
2. **Un trait sous la règle**, facultatif.
3. **Les lignes de la main droite.**
4. **Le trait entre les mains**, obligatoire, même quand une main ne joue pas.
5. **Les lignes de la main gauche.**

Les traits s'écrivent avec `─`, `-`, `=`, `+` ou `┼`, sans espace.

### Les cases

Un temps est une suite de cases de largeur fixe (`case`, 3 par défaut). Un temps de 12 caractères contient donc 4 ancres.

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

- À gauche du premier `|`, le numéro d'octave (do central = octave 4). On ne l'écrit que sur la première ligne d'un groupe : les lignes suivantes sans numéro appartiennent à la même octave.
- Une ligne ne porte jamais deux notes en même temps. Un accord occupe une ligne par note.
- Tous les `|` d'une ligne sont alignés sur ceux de la règle. Les espaces en fin de ligne peuvent être omis.

### Les sauts de ligne

Ils sont libres : on peut écrire une mesure par système ou couper une mesure entre deux temps. Un système qui reprend une mesure inachevée commence par le même numéro et par le temps suivant (`m12|3 …`).

Une anacrouse commence directement au temps voulu : `m0|3  ||` pour un levé d'un temps en 3/4.

Les lignes qui commencent par `#` sont des commentaires.

## Hors format pour l'instant

Reprises (déroulées à l'import), pédale, ornements, articulations, nuances.

## Outil en ligne de commande

```
npm run ymn -- import morceau.musicxml -o morceau.ymn --largeur 96
npm run ymn -- format morceau.ymn -o morceau.ymn --largeur 120
npm run ymn -- check morceau.ymn
```

`format` relit un fichier et le remet en page à la largeur demandée. `check` signale la première erreur, avec sa ligne et sa colonne.
