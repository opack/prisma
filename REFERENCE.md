# Lire et jouer en Prisma

Cette référence s'adresse au musicien. Elle explique comment lire une partition Prisma et pourquoi elle est faite ainsi, en partant de ce que vous connaissez peut-être de la partition classique. Elle ne remplace pas [FORMAT.md](FORMAT.md), qui décrit le format exactement.

Si vous ne lisez pas la partition classique, ignorez simplement les comparaisons : tout ce qu'il faut savoir pour jouer est dit ici.

La notation n'est pas propre à un instrument : elle note des hauteurs et des durées. Les exemples sont pris au piano, son premier usage, et quelques indications ne concernent que lui (la pédale, les doigtés).

## 1. Le principe

Trois idées suffisent :

1. **Une note, un numéro.** Les douze notes d'une octave (au piano, ses touches blanches et noires) sont numérotées de `1` à `12`. Pas de noms de notes, pas de dièses ni de bémols.
2. **La position, c'est le temps.** Une note se lit de gauche à droite sur une règle de comptage, comme sur une frise. Sa place dit quand elle commence, sa longueur combien de temps elle dure.
3. **Ce qui est aligné verticalement se joue ensemble.** Toutes les portées partagent la même règle.

```prisma
m1 |1  *  |2  *  |3  *  |4  ||
───┼──────┼──────┼──────┼───┼┼
0  |1  3  |5  6  |8  10 |12 ||
───┼──────┼──────┼──────┼───┼┼
-1 |1  -  |-  -  |8  -  |-  ||
```

La portée du haut (au piano, la main droite) monte la gamme de *do* (`1`, `3`, `5`, `6`, `8`, `10`, `12`) en deux notes par temps. Celle du bas (la main gauche) tient un *do* pendant deux temps, puis un *sol*.

De haut en bas : la **règle de comptage** (`m1` pour la mesure 1, puis les temps), un trait, les lignes de la portée du haut, un second trait qui sépare les deux portées, puis les lignes de la portée du bas. Le `12` de la fin dure jusqu'au bout du temps 4 : il n'a pas besoin d'autre case.

Un morceau Prisma existe sous deux formes : un **texte** (le fichier `.prisma`), qu'on tape au clavier, et une **partition**, la page imprimable produite par l'application. Les deux disent exactement la même chose. Ici, chaque exemple se montre sous ses deux formes : son texte et sa gravure.

## 2. Les hauteurs

### Les numéros

| Numéro | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9` | `10` | `11` | `12` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Note | *do* | *do♯* *ré♭* | *ré* | *ré♯* *mi♭* | *mi* | *fa* | *fa♯* *sol♭* | *sol* | *sol♯* *la♭* | *la* | *la♯* *si♭* | *si* |

Au piano, les touches noires sont `2`, `4`, `7`, `9` et `11`. Le numéro désigne une hauteur, pas un nom : *do♯* et *ré♭* sonnent pareil, ils ont donc le même numéro. Il n'y a ni armure à retenir, ni altération qui vaut jusqu'à la fin de la mesure. Ce qui est écrit est ce qu'on joue.

Pour jouer, la tonalité n'est donc pas nécessaire. Pour qui veut la connaître (improviser, comprendre l'harmonie), l'en-tête peut la donner, une fois pour toutes : `key: 8` pour *sol* majeur, `key: 5:m` pour *mi* mineur (ou en anglais, `key: G`, `key: Em`). C'est une simple information, affichée en tête de la partition : elle ne change aucune note.

### Les octaves

Chaque ligne de notes appartient à une octave, indiquée à gauche :

- `0` : l'octave qui commence au *do* central (*do3* en France, *C4* ailleurs : c'est la même note) ;
- `+1`, `+2`… : les octaves au-dessus ; `-1`, `-2`… : celles du dessous. Un piano de 88 touches va de `-4` à `+4`.

La partition les montre dans un onglet à gauche (▲1, 0, ▼1). Les lignes d'une même octave forment un **couloir** ; les couloirs sont rangés de l'aigu (en haut) au grave (en bas).

Pour apprendre à situer les octaves, l'application peut donner à chaque couloir une couleur pâle, toujours la même pour une octave donnée, dans tous les morceaux (option « Couleurs », onglet Octaves) : on peut alors coller des pastilles de la même couleur sur l'instrument. Le numéro d'octave reste affiché, pour une impression en noir et blanc.

Ce système remplace les clés (*sol*, *fa*, *ut*), les portées, les lignes supplémentaires et les « 8va » : l'octave de chaque note est écrite sur sa ligne, une fois pour toutes.

### Les portées

Une **portée** est un groupe de lignes de notes : au piano, chaque main est une portée ; une voix, une flûte en sont une. Une portée n'est liée à aucune clé ni aucune hauteur : chacune peut aller de l'extrême grave à l'extrême aigu. Toutes les portées partagent la règle de comptage : ce qui est aligné verticalement sonne ensemble.

Un trait simple sépare les portées d'une même **partie** (les deux mains du piano), un trait double deux parties. Leurs noms sont annoncés en tête du fichier (`parts:`) et écrits sur le trait qui ouvre chacune :

```prisma
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

La partition réunit les portées d'une partie par une accolade et écrit les noms à gauche du premier système.

À l'écoute, le nom d'une partie fait choisir l'instrument qui la joue : « Chant » se chante, « Flûte » ou « Violin » sonnent comme tels, et un nom qui ne dit rien d'un instrument se joue au piano. Pour un nom libre (« Chœur de droite », « Premier violon »), l'instrument s'écrit entre parenthèses après le nom, dans `parts:`, en anglais : `parts: Chœur de droite (flute), Piano`. Les instruments : `piano`, `electric-piano`, `harpsichord`, `organ`, `accordion`, `guitar`, `electric-bass`, `harp`, `violin`, `viola`, `cello`, `double-bass`, `strings`, `flute`, `oboe`, `clarinet`, `bassoon`, `saxophone`, `trumpet`, `horn`, `trombone`, `voice`, `marimba`, `vibraphone`.

L'application permet aussi de choisir un autre instrument pour soi, dans le menu « Parties et instruments » à côté du bouton de la musique, sans toucher au fichier ; une flèche ↺ reprend celui de la partition.

### Les accords

Une ligne ne porte qu'une note à la fois. Un accord occupe une ligne par note, la plus aiguë en haut :

```prisma
m1 |1  |2  |3  |4  ||
───┼───┼───┼───┼───┼┼
0  |8  |-  |8  |-  ||
   |5  |-  |3  |-  ||
   |1  |-  |1  |-  ||
───┼───┼───┼───┼───┼┼
-1 |1  |-  |-  |-  ||
```

Les lignes sans numéro d'octave continuent le couloir du dessus. Dans le texte comme sur la partition, les octaves d'une portée se suivent de l'aigu (en haut) au grave (en bas), chacune numérotée une seule fois.

Dans le fichier, chaque accord se range depuis le haut de son couloir. Sur la partition, l'option « Position » de l'onglet Notes, à « Alignées », garde sur sa ligne une note rejouée d'un temps à l'autre, quitte à laisser des lignes vides : après `8 5 1`, un accord `5 1` reste sur les deux lignes du bas au lieu de remonter, et l'on suit des yeux les notes qui reviennent. Le fichier ne change pas.

### Les instruments à cordes

Une partie de guitare ou de basse s'écrit comme une tablature : chaque ligne est une **corde**, numérotée de `1`, la plus aiguë, en haut, à `6` (`4` pour la basse), et le nombre est la **case** où appuyer, de `0` (la corde à vide) à `24`. Le principe ne change pas : au piano, le couloir dit l'octave et le nombre la touche ; ici, le couloir dit la corde et le nombre la case. On lit et on joue sans calcul. Voici un arpège de *la* mineur, la corde de *la* à vide tenue pendant trois temps :

```prisma
---
parts: Guitare
---

m1 |1  *  |2  *  |3  *  |4  *  ||
───┼─ Guitare ───┼──────┼──────┼┼
1  |      |      |0     |      ||
2  |      |   1  |   1  |      ||
3  |      |2     |      |2     ||
4  |   2  |      |      |   2  ||
5  |0  -  |-  -  |-  -  |      ||
```

Le choix de la corde est celui de qui écrit le morceau : une même note se joue sur plusieurs cordes, et la tablature dit laquelle. Le rythme est celui de toute partition Prisma, sur la règle de comptage, et la tenue `-` dit combien de temps la corde sonne : on voit ce qu'on laisse sonner et ce qu'on étouffe. Une corde ne joue qu'une note à la fois : une ligne par corde, chacune écrite une seule fois par système. La partition montre toujours toutes les cordes, avec le nom de leur note à vide.

L'instrument se reconnaît au nom de la partie (« Guitare », « Basse électrique »), ou s'écrit entre parenthèses (`guitar`, `electric-bass`). Après lui viennent, s'il le faut, l'accordage et le capo : `parts: Guitare (drop-d, capo 2)`. Les accordages de la guitare : `standard` (par défaut), `drop-d` (la 6ᵉ corde baissée en *ré*), `dadgad`, `open-g`, `open-d` ; de la basse : `standard`, `drop-d`. Avec un capo, les cases se comptent depuis lui, comme en tablature : `0` est la corde jouée au capo.

La page [Guitare et basse](guitare.html) du site les présente pas à pas, à côté d'une tablature.

### Les techniques des cordes

Ce qui touche une note s'écrit dans sa case, avec les signes des tablatures :

- `x` : **note étouffée**. La main touche la corde sans appuyer : un son sec, sans hauteur.
- `<12>` : **harmonique naturelle**. On effleure la corde au-dessus de la case, sans appuyer : à la case 12, elle sonne une octave au-dessus de la corde à vide ; à la 7 (ou la 19), une quinte de plus ; à la 5 (ou la 24), deux octaves ; à la 4, la 9 ou la 16, deux octaves et une tierce ; à la 3, deux octaves et une quinte.
- `7/` : **glissé**. Le doigt glisse sur la corde jusqu'à la note suivante de la même corde, sans la rejouer ; la partition trace le trait vers le haut ou vers le bas.
- `7b9` : **bend**. On tire la corde, appuyée en case 7, jusqu'à ce qu'elle sonne comme la case 9 ; `7b9r` la relâche ensuite. La partition dessine, comme en tablature, la flèche qui part de la case et monte au-dessus des cordes, et l'écart au-dessus d'elle : `½` pour un demi-ton, `full` pour un ton, `1½`, `2` ; relâché, une seconde flèche redescend.

Le **hammer-on** et le **pull-off** sont une liaison : `(--)` entre deux notes de la même corde dit que la seconde ne se rejoue pas au médiator, le doigt la frappe (hammer-on, quand elle monte) ou la tire (pull-off, quand elle descend). La partition écrit `H` ou `P` sous la liaison. Sans liaison, les deux notes sont deux attaques.

Sur la ligne `@` de la portée, comme les articulations : le **sens du médiator**, `d` vers le bas et `u` vers le haut, case par case, gravés ⊓ et V en grand au-dessus des cordes, comme partout en tablature ; l'**étouffé de la paume**, `P.M.---`, la tranche de la main posée sur les cordes près du chevalet jusqu'au bout du trait ; le **vibrato**, `~~~~`, la note qui ondule jusqu'au bout des vagues.

```prisma
---
parts: Guitare
---

m1 |1    |2  |3    |4  ||1  |2  |3  |4     ||
───┼─ Guitare ─────┼───┼┼───┼───┼───┼──────┼┼
1  |<12> |x  |7b9r |5/ ||8  |5  |7  |10b12 ||
3  |5    |7  |     |   ||   |   |   |      ||
@                        (--------)
@   d     u   P.M.----           ~~~~~~~~~
```

À l'écoute, une note étouffée et l'étouffé de la paume sonnent courts et sourds, une harmonique à sa hauteur, un bend et un glissé passent d'une hauteur à l'autre sans nouvelle attaque, comme un hammer-on ou un pull-off ; le vibrato ne s'entend pas.

## 3. Le temps

### Ce que veut dire 4/4, 3/4, 6/8…

Une indication de mesure X/Y se lit ainsi : le chiffre du **bas** donne l'unité (4 : la noire, 8 : la croche, 2 : la blanche), celui du **haut** combien de ces unités tiennent dans une mesure.

- **4/4** : 4 noires par mesure, chaque noire est un temps, coupé naturellement en 2.
- **3/4** : 3 temps, coupés en 2 (la valse).
- **6/8** : 6 croches, mais on ne compte pas 6 temps : on les regroupe par 3, soit **2 temps coupés en 3**.
- **12/8** : 12 croches groupées par 3, soit **4 temps coupés en 3**.

Quand le chiffre du haut vaut 6, 9 ou 12, la mesure est dite **composée** : le vrai temps vaut trois unités. Sinon, elle est **simple**.

Prisma ne garde que ce qui sert à jouer : **le nombre de temps** et **le découpage naturel du temps**, en 2 ou en 3. Le 3/4 et le 6/8 ont tous deux 6 croches par mesure, mais ce sont deux mesures différentes, et ici la différence se voit :

```prisma
m1 |1  *  |2  *  |3  *  ||
───┼──────┼──────┼──────┼┼
0  |1  3  |5  6  |8  6  ||
───┼──────┼──────┼──────┼┼
```

```prisma
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

| Étiquette | Découpage | Sur la partition |
|---|---|---|
| `1`, `2`… | début du temps | le numéro |
| `*` | premier découpage : un `*` coupe le temps en 2, deux `*` en 3 | un astérisque |
| `.` | chaque morceau recoupé en 2 | un point |
| `,` | plus fin encore | une virgule |

En 4/4 : `1  *` pour des croches, `1  .  *  .` pour des doubles croches. En 6/8 : `1  *  *` pour des croches, `1  .  *  .  *  .` pour des doubles croches.

### Ce qui disparaît

- **Les figures de note** (ronde, blanche, croche…) et **les points** : une note dure jusqu'à la fin de son trait `-`. Une croche pointée suivie d'une double croche, c'est une note sur trois cases et une sur la quatrième :

  ```prisma
  m1 |1  .  *  .  |2  ||
  ───┼────────────┼───┼┼
  0  |5  -  -  7  |8  ||
  ───┼────────────┼───┼┼
  ```

- **Les silences** : une case vide est un silence. Rien à compter, on voit le vide.
- **Les liaisons de prolongation** : une note qui continue au-delà d'une barre garde son trait `-`. En début de ligne, elle est rappelée en gris : `-7` veut dire « le `7` commencé plus tôt continue ».
- **Les triolets, duolets, octolets** : la partition classique a besoin d'un chiffre (3, 2, 8…) quand les figures ne savent pas couper le temps comme il faut. Ici, le temps se coupe simplement en autant de cases qu'il faut. Un triolet en 4/4 est un temps de trois cases, `1  *  *` ; un duolet en 9/8, un temps de deux cases, `1  *`.

Quand les deux portées ne coupent pas le temps de la même façon, la règle porte les deux découpages à la fois. Trois notes contre deux donnent six cases : la portée du haut joue toutes les deux cases, celle du bas toutes les trois.

```prisma
m1 |1  ,  ,  *  ,  ,  |2  ||
───┼──────────────────┼───┼┼
0  |5  -  8  -  12 -  |1  ||
───┼──────────────────┼───┼┼
-1 |1  -  -  8  -  -  |1  ||
```

On voit exactement quelle note du haut tombe avant ou après chaque note du bas. Pour un 3 contre 8 (le temps 2 de la mesure 30 du Nocturne op. 9 n° 2 de Chopin), il faut 24 cases : c'est large, mais c'est la vérité du rythme, qu'une partition classique cache derrière un « 8 ».

## 4. Petites notes, ornements, point d'orgue, doigtés

Les signes qui accompagnent une note se collent à elle, dans sa case. Chacun a un seul sens.

| Signe | Exemple | Sens | Sur la partition |
|---|---|---|---|
| `'` | `3'5` | petite note : un `3` très bref, puis le `5` sur le temps | en petit, en exposant, devant la note |
| `~` | `5~6` | trille : le `5` (*mi*) alterne avec le `6` (*fa*) pendant toute sa durée | la voisine en petit, puis un trait ondulé |
| `_` | `5_3` | doigté : le `5` se joue avec le doigt 3 (au piano, 1 = pouce) | un chiffre blanc sur une pastille sombre, en bas à droite |

```prisma
m1 |1        |2  |3     |4   ||
───┼─────────┼───┼──────┼────┼┼
+1 |3'       |   |      |    ||
0  |  7'9'5  |-  |5~6_3 |8_4 ||
───┼─────────┼───┼──────┼────┼┼
-1 |      1  |8  |5     |1   ||
```

- **Petites notes** : il n'y en a qu'une sorte. La partition classique distingue l'appoggiature (non barrée) de l'acciaccature (barrée), mais les éditions ne s'accordent pas sur leur usage, et c'est de toute façon au musicien de les placer. Plusieurs petites notes s'enchaînent (`7'9'5`) et se jouent de gauche à droite dans la case, même réparties sur plusieurs octaves : ci-dessus, `3` (octave du dessus), `7`, `9`, puis le `5`.
- **Trilles** : la note voisine est écrite en clair. Sur une partition classique, le signe *tr* ne dit pas avec quelle note alterner : il faut connaître l'armure, ou lire une petite altération au-dessus du signe. Ici, rien à déduire.
- **Mordants et gruppettos** : leurs notes sont fixées par la convention, alors on les écrit directement en petites notes. En *do* majeur, un mordant sur *mi* donne `5'6'5` (*mi*, *fa*, *mi*), un gruppetto `6'5'3'5` (*fa*, *mi*, *ré*, *mi*). Vous lisez les notes au lieu de décoder un symbole.
- **Doigtés** : facultatifs, et l'application peut les masquer pour alléger la page.

Deux signes se posent sur une ligne `@`, au-dessus ou sous les notes :

- `^` sur la ligne `@` du haut : **point d'orgue**. On tient la note, l'accord ou le silence plus longtemps que prévu. Il n'y en a qu'un pour toutes les portées, puisqu'il suspend le temps lui-même (la partition classique le répète sur chaque portée).
- `/` : **arpège**. On égrène l'accord du grave à l'aigu (`\` : de l'aigu au grave). Sur la ligne `@` d'une portée, il ne concerne qu'elle ; sur celle du haut, toutes les portées d'un seul geste (au piano, les deux mains).

## 5. La structure

### Les reprises

`||:` et `:||` encadrent un passage à jouer deux fois ; `3×` au-dessus de la mesure qui le termine demande trois passages. Rien d'autre.

### Les sections

La partition classique multiplie les renvois : cases 1. et 2., D.C. (*da capo*, reprendre au début), D.S. (*dal segno*, reprendre au signe 𝄋), coda (𝄌), Fine. Il faut les repérer, les retenir et sauter dans la page en jouant.

Prisma les remplace tous par un seul mécanisme, celui d'une chanson : le morceau est découpé en **sections**, marquées par une lettre (`[A]`, `[B]`…), et l'**ordre de jeu** est écrit une fois pour toutes en tête du fichier, et de chaque page de la partition : `A A B A C`. On joue les sections dans cet ordre, et le morceau s'arrête à la fin de la liste. Chaque section commence une nouvelle ligne, comme un couplet.

```prisma
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

Ces indications s'écrivent sur des lignes `@`, placées sous les lignes de la portée qu'elles concernent. Chacune commence sur la case où elle prend effet.

```prisma
m1 |1    |2  |3  |4  ||1     |2  |3  |4  ||
───┼─────┼───┼───┼───┼┼──────┼───┼───┼───┼┼
0  |5    |7  |8  |10 ||8     |7  |5  |3  ||
@   (----------------------------------)
@   p     <---------   f >----------
───┼─────┼───┼───┼───┼┼──────┼───┼───┼───┼┼
-1 |1    |-  |-  |-  ||8     |-  |-  |-  ||
@   Ped.               *Ped.          *
```

- **Nuances** : `pp`, `p`, `mp`, `mf`, `f`, `ff`… comme sur une partition classique, écrites en gras italique.
- **Soufflets** : `<----` crescendo, `>----` decrescendo, de leur première case à la dernière.
- **Liaisons d'expression** : `(-----)`, de la première à la dernière note liée. Elles dessinent les phrases ; la partition les trace en arcs fins juste sous les lignes de la portée.
- **Articulations**, sur la case de l'attaque, pour la note ou tout l'accord : `.` staccato (détaché, plus court), `!` accent (plus fort), `!!` marcato (plus fort et plus sec). La partition dessine le point, le `>` ou le `^` classique en haut à droite de la note. Le tenuto n'a pas de signe : la durée écrite est déjà la durée jouée.
- **Pédale** (piano), sous la portée du bas : `Ped.` enfonce, `*` relâche, `*Ped.` change. La partition trace un trait sous le système, avec une pointe à chaque changement : on voit exactement ce qui est tenu. Une consigne comme `Ped. simile` (« continuer de même ») s'écrit sur la même ligne.

### Les accords d'accompagnement

Les accords à jouer par un accompagnateur (guitare, ou un pianiste qui improvise) s'écrivent sur une ligne `@c` (*chords*), au-dessus de la règle, chacun sur la case où il commence :

```prisma
@c  10:m             8/12
m1 |1    *  |2  *  ||1    |2  ||
───┼────────┼──────┼┼─────┼───┼┼
0  |5    3  |1  3  ||3    |-  ||
───┼────────┼──────┼┼─────┼───┼┼
-1 |10   -  |-  -  ||12   |-  ||
```

Un accord s'écrit de préférence par son **nom Prisma** : sa fondamentale en nombre, puis, après un `:`, la sorte d'accord, et après un `/` la basse si elle diffère. `10:m` est *la* mineur, `8:7` *sol* 7, `8/12` *sol* avec *si* à la basse ; l'accord majeur n'a pas de `:` (`8`, *sol* majeur). Les sortes d'accords sont celles des noms habituels : `m`, `7`, `maj7`, `m7`, `dim`, `sus4`…

On peut aussi l'écrire par son **nom anglais** (`Am`, `G7`, `G/B`), lu par les accompagnateurs du monde entier, ou par ses **notes Prisma** séparées par des virgules, de la basse vers l'aigu : `10:m` s'écrit aussi `10,1,5`. L'ordre compte : `10:m7` (`10,1,5,8`) et `1:6` (`1,5,8,10`) ont les mêmes notes, seule la basse les distingue. Les notes n'ont pas d'octave : un accord dit quelles notes jouer, pas où.

La partition montre le nom, les notes empilées (la basse en bas, comme sur les lignes d'octave), ou les deux (option « Accompagnement », onglet Partition), et le nom en Prisma ou en anglais (option « Nom des accords ») : l'application calcule l'un à partir de l'autre. Dans l'éditeur, Ctrl+Espace sur une case d'une ligne `@c` propose l'accord des notes qui y sonnent.

Pour la guitare, l'option « Accompagnement » a une valeur de plus, « Nom et grille » : sous le nom de l'accord, sa grille, le manche debout (la corde la plus grave à gauche), un point par doigt, un trait pour un barré, `×` au-dessus d'une corde qu'on ne joue pas et `o` d'une corde à vide. L'application prend la forme la plus simple qui joue l'accord sur la guitare du morceau (son accordage, son capo) : les accords ouverts que tout guitariste connaît, sinon les barrés. Pour une autre forme, on l'écrit après le nom et un `=`, de la corde la plus grave à la plus aiguë, `x` pour une corde qu'on ne joue pas, `0` à vide, sinon la case : `10:m=x02210`, `8=355433` ; un trait sépare les cases quand l'une a deux chiffres (`x-12-14-14-13-x`). Avec un capo, les cases se comptent depuis lui, et l'accord reste celui qui sonne : au capo 2, `3=x32010` (*ré*, la forme de *do*). Une grille ne joue que des notes de son accord. Pour garder la partition légère, une case de l'onglet Partition, « Récapituler les grilles en tête de partition », les dessine une fois sous le titre, chaque accord du morceau dans l'ordre où il vient, comme sur un recueil de chansons : avec l'accompagnement à « Nom », on lit le nom en jouant et l'on regarde la forme en tête. Dans l'éditeur, une grille tapée seule (`x02210`), puis Ctrl+Espace, propose l'accord qu'elle joue sur la guitare du morceau (`10:m=x02210`) ; un accord tapé sans grille, l'accord avec la sienne.

### Les paroles

Les paroles s'écrivent sur une ligne `@l` (*lyrics*) sous les lignes de la portée qui chante, chaque syllabe sur la case de sa note. Un couplet par ligne, le premier en haut :

```prisma
m1 |1  |2     |3     |4   ||1    |2  |3   |4  ||
───┼───┼──────┼──────┼────┼┼─────┼───┼────┼───┼┼
0  |1  |1     |1     |3   ||5    |-  |3   |-  ||
@l  Au  clair  de     la    lu-       ne,
@l  Ma  chan-  delle  est   mor-      te,
───┼───┼──────┼──────┼────┼┼─────┼───┼────┼───┼┼
-1 |1  |-     |-     |-   ||8    |-  |-   |-  ||
```

- Un `-` collé à la fin d'une syllabe la relie à la suivante, dans le même mot : `lu- ne`. La partition trace le trait d'union entre les deux.
- Une syllabe chantée sur plusieurs notes (un mélisme) est suivie de `---` jusqu'à sa dernière note, comme une note tenue ; la partition la prolonge d'un trait bas :

```prisma
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

| Partition classique | Prisma |
|---|---|
| noms de notes, dièses, bémols, bécarres | numéros de `1` à `12`, un par hauteur |
| armure | rien : chaque numéro est la note jouée |
| clés, portées | des portées (au piano, les deux mains) séparées par un trait ; un trait double entre deux parties |
| lignes supplémentaires, 8va, 15ma, loco | numéro d'octave sur chaque ligne (`0`, `+1`, `-1`…) |
| tablature (guitare, basse) | une ligne par corde (`1`, l'aiguë, en haut), le nombre est la case (`0` à vide) ; le rythme sur la règle |
| ronde, blanche, noire, croche… et points | la longueur de la note sur la règle (`-`) |
| silences | case vide |
| liaison de prolongation | la note continue (`-`), rappelée `-N` en début de ligne |
| indication de mesure X/Y | nombre de temps, chacun coupé en 2 ou en 3 (`1  *`, `1  *  *`) |
| triolet, duolet, octolet | le temps coupé en autant de cases qu'il faut |
| appoggiature, acciaccature | petite note : `3'5` |
| trille *tr*~~~ | `5~6`, la voisine écrite en clair |
| mordant, gruppetto | écrits en petites notes : `5'6'5`, `6'5'3'5` |
| arpège (vaguelette) | `/` sur une ligne `@` |
| point d'orgue 𝄐 | `^` sur la ligne `@` du haut, une fois pour toutes les portées |
| doigtés | `5_3` |
| cases 1. et 2., D.C., D.S., segno, coda, Fine | sections (`[A]`) et ordre de jeu (`order: A B A C`) |
| reprises | `||:` … `:||`, et `3×` |
| nuances, soufflets | les mêmes, sous la portée concernée |
| liaisons d'expression | `(-----)` sous la portée concernée |
| staccato, accent, marcato | `.`, `!`, `!!` sous la portée concernée ; le tenuto n'a pas de signe |
| pédale | `Ped.`, `*`, `*Ped.`, tracés en trait continu |
| accords d'accompagnement (Am, G/B) | ligne `@c` : le nom Prisma (`10:m`, `8/12`), le nom anglais, ou les notes de la basse vers l'aigu (`10,1,5`) |
| techniques de la guitare (étouffée, harmonique, glissé, bend) | dans la case : `x`, `<12>`, `7/`, `7b9` (`7b9r` relâché) |
| hammer-on, pull-off | une liaison `(--)` entre deux notes de la même corde : `H` ou `P` sur la partition |
| médiator, étouffé de la paume, vibrato | sur la ligne `@` de la portée : `d` et `u` ; `P.M.---` ; `~~~~` |
| grille d'accord, pour la guitare | après le nom et `=`, la case de chaque corde, de la plus grave à la plus aiguë (`10:m=x02210`) |
| paroles, traits d'union, mélismes | une ligne `@l` par couplet, sous la portée qui chante : `lu- ne`, `men ---` |
