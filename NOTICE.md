# Lire et jouer en ymn

Cette notice s'adresse au musicien. Elle explique comment lire une partition ymn et pourquoi elle est faite ainsi, en partant de ce que vous connaissez peut-être de la partition classique. Elle ne remplace pas [FORMAT.md](FORMAT.md), qui décrit le format exactement.

Si vous ne lisez pas la partition classique, ignorez simplement les comparaisons : tout ce qu'il faut savoir pour jouer est dit ici.

La notation n'est pas propre à un instrument : elle note des hauteurs et des durées. Les exemples sont pris au piano, son premier usage, et quelques indications ne concernent que lui (la pédale, les doigtés).

## 1. Le principe

Trois idées suffisent :

1. **Une note, un numéro.** Les douze notes d'une octave (au piano, ses touches blanches et noires) sont numérotées de 1 à 12. Pas de noms de notes, pas de dièses ni de bémols.
2. **La position, c'est le temps.** Une note se lit de gauche à droite sur une règle de comptage, comme sur une frise. Sa place dit quand elle commence, sa longueur combien de temps elle dure.
3. **Ce qui est aligné verticalement se joue ensemble.** Toutes les parties partagent la même règle.

```ymn
m1 |1  *  |2  *  |3  *  |4  ||
───┼──────┼──────┼──────┼───┼┼
0  |1  3  |5  6  |8  10 |12 ||
───┼──────┼──────┼──────┼───┼┼
-1 |1  -  |-  -  |8  -  |-  ||
```

La partie du haut (au piano, la main droite) monte la gamme de do (1, 3, 5, 6, 8, 10, 12) en deux notes par temps. Celle du bas (la main gauche) tient un do pendant deux temps, puis un sol.

De haut en bas : la **règle de comptage** (`m1` pour la mesure 1, puis les temps), un trait, les lignes de la partie du haut, un second trait qui sépare les deux parties, puis les lignes de la partie du bas. Le 12 de la fin dure jusqu'au bout du temps 4 : il n'a pas besoin d'autre case.

Une partition ymn existe sous deux formes : un **texte** (le fichier `.ymn`), qu'on tape au clavier, et une **gravure**, la page imprimable produite par l'application. Les deux disent exactement la même chose. Dans l'application (bouton « Notice »), chaque exemple de cette notice est montré sous ses deux formes : son texte, puis sa gravure.

## 2. Les hauteurs

### Les numéros

| Numéro | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | do | do♯ ré♭ | ré | ré♯ mi♭ | mi | fa | fa♯ sol♭ | sol | sol♯ la♭ | la | la♯ si♭ | si |

Au piano, les touches noires sont 2, 4, 7, 9 et 11. Le numéro désigne une hauteur, pas un nom : do♯ et ré♭ sonnent pareil, ils ont donc le même numéro. Il n'y a ni armure à retenir, ni altération qui vaut jusqu'à la fin de la mesure. Ce qui est écrit est ce qu'on joue.

### Les octaves

Chaque ligne de notes appartient à une octave, indiquée à gauche :

- `0` : l'octave qui commence au do central (do3 en France, C4 ailleurs : c'est la même note) ;
- `+1`, `+2`… : les octaves au-dessus ; `-1`, `-2`… : celles du dessous. Un piano de 88 touches va de `-4` à `+4`.

La gravure les montre dans un onglet à gauche (▲1, 0, ▼1). Les lignes d'une même octave forment un **couloir** ; les couloirs sont rangés de l'aigu (en haut) au grave (en bas).

Pour apprendre à situer les octaves, l'application peut donner à chaque couloir une couleur pâle, toujours la même pour une octave donnée, dans tous les morceaux (options « Couleurs ») : on peut alors coller des pastilles de la même couleur sur l'instrument. Le numéro d'octave reste affiché, pour une impression en noir et blanc.

Ce système remplace les clés (sol, fa, ut), les portées, les lignes supplémentaires et les « 8va » : l'octave de chaque note est écrite sur sa ligne, une fois pour toutes.

### Les parties

Une **partie** est un groupe de lignes de notes : au piano, chaque main est une partie ; une voix, une flûte en sont une. Une partie n'est liée à aucune clé ni aucune hauteur : chacune peut aller de l'extrême grave à l'extrême aigu. Toutes les parties partagent la règle de comptage : ce qui est aligné verticalement sonne ensemble.

Un trait simple sépare les parties d'un même **instrument** (les deux mains du piano), un trait double deux instruments. Leurs noms sont annoncés en tête du fichier (`parts:`) et écrits sur le trait qui ouvre chacun :

```ymn
---
parts: Chant, Piano
---

m1 |1    |2  |3  |4   ||
───┼─ Chant ─┼───┼────┼┼
0  |8    |-  |10 |8   ||
@l  Ah ---------  oui
═══╪═ Piano ═╪═══╪════╪╪
0  |5    |   |5  |    ||
───┼─────┼───┼───┼────┼┼
-1 |1    |-  |8  |-   ||
@   Ped.          *
```

La gravure réunit les parties d'un instrument par une accolade et écrit les noms à gauche du premier système.

### Les accords

Une ligne ne porte qu'une note à la fois. Un accord occupe une ligne par note, la plus aiguë en haut :

```ymn
m1 |1  |2  |3  |4  ||
───┼───┼───┼───┼───┼┼
0  |8  |-  |8  |-  ||
   |5  |-  |3  |-  ||
   |1  |-  |1  |-  ||
───┼───┼───┼───┼───┼┼
-1 |1  |-  |-  |-  ||
```

Les lignes sans numéro d'octave continuent le couloir du dessus.

Dans le fichier, chaque accord se range depuis le haut de son couloir. À la gravure, l'option « Notes : alignées » garde sur sa ligne une note rejouée d'un temps à l'autre, quitte à laisser des lignes vides : après `8 5 1`, un accord `5 1` reste sur les deux lignes du bas au lieu de remonter, et l'on suit des yeux les notes qui reviennent. Le fichier ne change pas.

## 3. Le temps

### Ce que veut dire 4/4, 3/4, 6/8…

Une indication de mesure X/Y se lit ainsi : le chiffre du **bas** donne l'unité (4 : la noire, 8 : la croche, 2 : la blanche), celui du **haut** combien de ces unités tiennent dans une mesure.

- **4/4** : 4 noires par mesure, chaque noire est un temps, coupé naturellement en 2.
- **3/4** : 3 temps, coupés en 2 (la valse).
- **6/8** : 6 croches, mais on ne compte pas 6 temps : on les regroupe par 3, soit **2 temps coupés en 3**.
- **12/8** : 12 croches groupées par 3, soit **4 temps coupés en 3**.

Quand le chiffre du haut vaut 6, 9 ou 12, la mesure est dite **composée** : le vrai temps vaut trois unités. Sinon, elle est **simple**.

ymn ne garde que ce qui sert à jouer : **le nombre de temps** et **le découpage naturel du temps**, en 2 ou en 3. Le 3/4 et le 6/8 ont tous deux 6 croches par mesure, mais ce sont deux mesures différentes, et ici la différence se voit :

```ymn
m1 |1  *  |2  *  |3  *  ||
───┼──────┼──────┼──────┼┼
0  |1  3  |5  6  |8  6  ||
───┼──────┼──────┼──────┼┼
```

```ymn
---
division: 3
---

m1 |1  *  *  |2  *  *  ||
───┼─────────┼─────────┼┼
0  |1  3  5  |6  8  6  ||
───┼─────────┼─────────┼┼
```

Le premier est un 3/4 (3 temps de 2), le second un 6/8 (2 temps de 3). La clé `division: 3`, en tête du fichier, dit que ses temps se coupent en 3 par défaut.

### La règle de comptage

Chaque temps commence par son numéro, puis se coupe en **cases** de même durée. Les étiquettes de la règle disent où l'on en est :

| Étiquette | Découpage | Gravure |
|---|---|---|
| `1`, `2`… | début du temps | le numéro |
| `*` | premier découpage : un `*` coupe le temps en 2, deux `*` en 3 | un astérisque |
| `.` | chaque morceau recoupé en 2 | un point |
| `,` | plus fin encore | une virgule |

En 4/4 : `1  *` pour des croches, `1  .  *  .` pour des doubles croches. En 6/8 : `1  *  *` pour des croches, `1  .  *  .  *  .` pour des doubles croches.

### Ce qui disparaît

- **Les figures de note** (ronde, blanche, croche…) et **les points** : une note dure jusqu'à la fin de son trait `-`. Une croche pointée suivie d'une double croche, c'est une note sur trois cases et une sur la quatrième :

  ```ymn
  m1 |1  .  *  .  |2  ||
  ───┼────────────┼───┼┼
  0  |5  -  -  7  |8  ||
  ───┼────────────┼───┼┼
  ```

- **Les silences** : une case vide est un silence. Rien à compter, on voit le vide.
- **Les liaisons de prolongation** : une note qui continue au-delà d'une barre garde son trait `-`. En début de ligne, elle est rappelée en gris : `-7` veut dire « le 7 commencé plus tôt continue ».
- **Les triolets, duolets, octolets** : la partition classique a besoin d'un chiffre (3, 2, 8…) quand les figures ne savent pas couper le temps comme il faut. Ici, le temps se coupe simplement en autant de cases qu'il faut. Un triolet en 4/4 est un temps de trois cases, `1  *  *` ; un duolet en 9/8, un temps de deux cases, `1  *`.

Quand les deux parties ne coupent pas le temps de la même façon, la règle porte les deux découpages à la fois. Trois notes contre deux donnent six cases : la partie du haut joue toutes les deux cases, celle du bas toutes les trois.

```ymn
m1 |1  ,  ,  *  ,  ,  |2  ||
───┼──────────────────┼───┼┼
0  |5  -  8  -  12 -  |1  ||
───┼──────────────────┼───┼┼
-1 |1  -  -  8  -  -  |1  ||
```

On voit exactement quelle note du haut tombe avant ou après chaque note du bas. Pour un 3 contre 8 (le temps 2 de la mesure 30 du Nocturne op. 9 n° 2 de Chopin), il faut 24 cases : c'est large, mais c'est la vérité du rythme, qu'une partition classique cache derrière un « 8 ».

## 4. Petites notes, ornements, point d'orgue, doigtés

Les signes qui accompagnent une note se collent à elle, dans sa case. Chacun a un seul sens.

| Signe | Exemple | Sens | Gravure |
|---|---|---|---|
| `'` | `3'5` | petite note : un 3 très bref, puis le 5 sur le temps | en petit, en exposant, devant la note |
| `~` | `5~6` | trille : le 5 (mi) alterne avec le 6 (fa) pendant toute sa durée | la voisine en petit, puis un trait ondulé |
| `_` | `5_3` | doigté : le 5 se joue avec le doigt 3 (au piano, 1 = pouce) | un chiffre blanc sur une pastille sombre, en bas à droite |

```ymn
m1 |1        |2  |3     |4   ||
───┼─────────┼───┼──────┼────┼┼
+1 |3'       |   |      |    ||
0  |  7'9'5  |-  |5~6_3 |8_4 ||
───┼─────────┼───┼──────┼────┼┼
-1 |      1  |8  |5     |1   ||
```

- **Petites notes** : il n'y en a qu'une sorte. La partition classique distingue l'appoggiature (non barrée) de l'acciaccature (barrée), mais les éditions ne s'accordent pas sur leur usage, et c'est de toute façon au musicien de les placer. Plusieurs petites notes s'enchaînent (`7'9'5`) et se jouent de gauche à droite dans la case, même réparties sur plusieurs octaves : ci-dessus, 3 (octave du dessus), 7, 9, puis le 5.
- **Trilles** : la note voisine est écrite en clair. Sur une partition classique, le signe *tr* ne dit pas avec quelle note alterner : il faut connaître l'armure, ou lire une petite altération au-dessus du signe. Ici, rien à déduire.
- **Mordants et gruppettos** : leurs notes sont fixées par la convention, alors on les écrit directement en petites notes. En do majeur, un mordant sur mi donne `5'6'5` (mi, fa, mi), un gruppetto `6'5'3'5` (fa, mi, ré, mi). Vous lisez les notes au lieu de décoder un symbole.
- **Doigtés** : facultatifs, et l'application peut les masquer pour alléger la page.

Deux signes se posent sur une ligne `@`, au-dessus ou sous les notes :

- `^` sur la ligne `@` du haut : **point d'orgue**. On tient la note, l'accord ou le silence plus longtemps que prévu. Il n'y en a qu'un pour toutes les parties, puisqu'il suspend le temps lui-même (la partition classique le répète sur chaque portée).
- `/` : **arpège**. On égrène l'accord du grave à l'aigu (`\` : de l'aigu au grave). Sur la ligne `@` d'une partie, il ne concerne qu'elle ; sur celle du haut, toutes les parties d'un seul geste (au piano, les deux mains).

## 5. La structure

### Les reprises

`||:` et `:||` encadrent un passage à jouer deux fois ; `3×` au-dessus de la mesure qui le termine demande trois passages. Rien d'autre.

### Les sections

La partition classique multiplie les renvois : cases 1. et 2., D.C. (*da capo*, reprendre au début), D.S. (*dal segno*, reprendre au signe 𝄋), coda (𝄌), Fine. Il faut les repérer, les retenir et sauter dans la page en jouant.

ymn les remplace tous par un seul mécanisme, celui d'une chanson : le morceau est découpé en **sections**, marquées par une lettre (`[A]`, `[B]`…), et l'**ordre de jeu** est écrit une fois pour toutes en tête du fichier, et de chaque page gravée : `A A B A C`. On joue les sections dans cet ordre, et le morceau s'arrête à la fin de la liste. Chaque section commence une nouvelle ligne, comme un couplet.

```ymn
---
order: A B A C
---

@  [A]
m1 |1  |2  ||1  |2  ||
───┼───┼───┼┼───┼───┼┼
0  |1  |3  ||5  |3  ||
───┼───┼───┼┼───┼───┼┼
-1 |1  |   ||8  |   ||

@  [B]
m3 |1  |2  ||
───┼───┼───┼┼
0  |8  |   ||
───┼───┼───┼┼
-1 |5  |   ||

@  [C]
m4 |1  |2  ||
───┼───┼───┼┼
0  |1  |   ||
───┼───┼───┼┼
-1 |1  |   ||
```

Ce morceau se joue A (mesures 1 et 2), B (3), A de nouveau, puis C (4) : c'est une reprise à deux cases, sans case.

## 6. Nuances, soufflets, liaisons, pédale

Ces indications s'écrivent sur des lignes `@`, placées sous les lignes de la partie qu'elles concernent. Chacune commence sur la case où elle prend effet.

```ymn
m1 |1    |2  |3  |4  ||1     |2  |3  |4  ||
───┼─────┼───┼───┼───┼┼──────┼───┼───┼───┼┼
0  |5    |7  |8  |10 ||8     |7  |5  |3  ||
@   p (--------------------------------)
@         <---------   f >----------
───┼─────┼───┼───┼───┼┼──────┼───┼───┼───┼┼
-1 |1    |-  |-  |-  ||8     |-  |-  |-  ||
@   Ped.               *Ped.          *
```

- **Nuances** : `pp`, `p`, `mp`, `mf`, `f`, `ff`… comme sur une partition classique, gravées en gras italique.
- **Soufflets** : `<----` crescendo, `>----` decrescendo, de leur première case à la dernière.
- **Liaisons d'expression** : `(-----)`, de la première à la dernière note liée. Elles dessinent les phrases ; la gravure les trace en arcs fins juste sous les lignes de la partie.
- **Pédale** (piano), sous la partie du bas : `Ped.` enfonce, `*` relâche, `*Ped.` change. La gravure trace un trait sous le système, avec une pointe à chaque changement : on voit exactement ce qui est tenu. Une consigne comme `Ped. simile` (« continuer de même ») s'écrit sur la même ligne.

### Les accords d'accompagnement

Les accords à jouer par un accompagnateur (guitare, ou un pianiste qui improvise) s'écrivent sur une ligne `@c` (*chords*), au-dessus de la règle, chacun sur la case où il commence :

```ymn
@c  Am             G/B
m1 |1  *  |2  *  ||1   |2  ||
───┼──────┼──────┼┼────┼───┼┼
0  |5  3  |1  3  ||3   |-  ||
───┼──────┼──────┼┼────┼───┼┼
-1 |10 -  |-  -  ||12  |-  ||
```

Un accord s'écrit au choix par son **nom anglais** (`Am`, `G7`, `F#m7b5`, `G/B` pour un sol avec si à la basse), lu partout ailleurs par les accompagnateurs, ou par ses **notes ymn** séparées par `;`, de la basse vers l'aigu : `Am` s'écrit aussi `10;1;5`. L'ordre compte : `Am7` (`10;1;5;8`) et `C6` (`1;5;8;10`) ont les mêmes notes, seule la basse les distingue. Les notes n'ont pas d'octave : un accord dit quelles notes jouer, pas où.

La gravure montre le nom, les notes empilées (la basse en bas, comme sur les lignes d'octave), ou les deux (options « Accords ») : l'application calcule l'un à partir de l'autre.

### Les paroles

Les paroles s'écrivent sur une ligne `@l` (*lyrics*) sous les lignes de la partie qui chante, chaque syllabe sur la case de sa note. Un couplet par ligne, le premier en haut :

```ymn
m1 |1  |2     |3     |4   ||1    |2  |3   |4  ||
───┼───┼──────┼──────┼────┼┼─────┼───┼────┼───┼┼
0  |1  |1     |1     |3   ||5    |-  |3   |-  ||
@l  Au  clair  de     la    lu-       ne,
@l  Ma  chan-  delle  est   mor-      te,
───┼───┼──────┼──────┼────┼┼─────┼───┼────┼───┼┼
-1 |1  |-     |-     |-   ||8    |-  |-   |-  ||
```

- Un `-` collé à la fin d'une syllabe la relie à la suivante, dans le même mot : `lu- ne`. La gravure trace le trait d'union entre les deux.
- Une syllabe chantée sur plusieurs notes (un mélisme) est suivie de `---` jusqu'à sa dernière note, comme une note tenue ; la gravure la prolonge d'un trait bas :

```ymn
m1 |1  |2   |3  |4  ||1  |2   |3  |4  ||
───┼───┼────┼───┼───┼┼───┼────┼───┼───┼┼
+1 |   |    |   |1  ||   |    |   |   ||
0  |8  |10  |12 |   ||12 |10  |8  |-  ||
@l  A-  men -------   A-  men -------
───┼───┼────┼───┼───┼┼───┼────┼───┼───┼┼
-1 |1  |-   |-  |-  ||8  |-   |-  |-  ||
```

Les indications de caractère et de tempo (`dolce`, `rit.`, `a tempo`…) gardent leurs mots habituels. Les indications d'octave (`8va`, `loco`…) n'existent pas : l'octave est déjà sur chaque ligne.

## 7. Récapitulatif

| Partition classique | ymn |
|---|---|
| noms de notes, dièses, bémols, bécarres | numéros de 1 à 12, un par hauteur |
| armure | rien : chaque numéro est la note jouée |
| clés, portées | des parties (au piano, les deux mains) séparées par un trait ; un trait double entre deux instruments |
| lignes supplémentaires, 8va, 15ma, loco | numéro d'octave sur chaque ligne (`0`, `+1`, `-1`…) |
| ronde, blanche, noire, croche… et points | la longueur de la note sur la règle (`-`) |
| silences | case vide |
| liaison de prolongation | la note continue (`-`), rappelée `-N` en début de ligne |
| indication de mesure X/Y | nombre de temps, chacun coupé en 2 ou en 3 (`1  *`, `1  *  *`) |
| triolet, duolet, octolet | le temps coupé en autant de cases qu'il faut |
| appoggiature, acciaccature | petite note : `3'5` |
| trille *tr*~~~ | `5~6`, la voisine écrite en clair |
| mordant, gruppetto | écrits en petites notes : `5'6'5`, `6'5'3'5` |
| arpège (vaguelette) | `/` sur une ligne `@` |
| point d'orgue 𝄐 | `^` sur la ligne `@` du haut, une fois pour toutes les parties |
| doigtés | `5_3` |
| cases 1. et 2., D.C., D.S., segno, coda, Fine | sections (`[A]`) et ordre de jeu (`order: A B A C`) |
| reprises | `||:` … `:||`, et `3×` |
| nuances, soufflets | les mêmes, sous la partie concernée |
| liaisons d'expression | `(-----)` sous la partie concernée |
| pédale | `Ped.`, `*`, `*Ped.`, tracés en trait continu |
| accords d'accompagnement (Am, G/B) | ligne `@c` : le nom, ou les notes de la basse vers l'aigu (`10;1;5`) |
| paroles, traits d'union, mélismes | une ligne `@l` par couplet, sous la partie qui chante : `lu- ne`, `men ---` |
