# Prisma

Prisma est une notation musicale chromatique : chaque note de l'octave porte un nombre de 1 à 12, chaque octave a son couloir, et le temps se lit sur une règle de comptage. Ce dépôt contient tout ce qui la fait vivre :

- le **format texte** `.prisma`, décrit exactement dans [FORMAT.md](FORMAT.md) ;
- l'**application** de gravure et d'écoute, dans le navigateur ;
- le **site** qui présente la notation et l'apprend ;
- un **outil en ligne de commande** (import et export MusicXML, remise en page, vérification).

Pour lire et jouer en Prisma, c'est [REFERENCE.md](REFERENCE.md). Ce document-ci s'adresse à qui veut comprendre le code ou y contribuer. Ce qui est fait et ce qui reste à faire est dans [ROADMAP.md](ROADMAP.md).

## Lancer, construire, tester

Il faut Node.js 22.18 ou plus récent (l'outil en ligne de commande s'exécute directement en TypeScript).

```sh
npm install
npm run dev        # le site sur http://localhost:5173/, l'application sur /app/
npm test           # les tests (Vitest)
npm run typecheck  # la vérification des types (tsc)
npm run build      # tsc, puis le site et l'application dans dist/
npm run preview    # sert dist/ pour l'essayer
```

L'outil en ligne de commande :

```sh
npm run prisma -- import morceau.musicxml -o morceau.prisma   # MusicXML → .prisma
npm run prisma -- export morceau.prisma -o morceau.musicxml   # .prisma → MusicXML (--reprises : en reprises et en cases)
npm run prisma -- format morceau.prisma -o propre.prisma      # remet en page (--largeur 96 par défaut)
npm run prisma -- check morceau.prisma                        # signale la première erreur, ligne et colonne
```

Sous Windows, préférez `-o` à une redirection `>` : PowerShell n'écrit pas toujours en UTF-8.

## Du texte aux pages

```
 MusicXML ──► core/musicxml.ts ───────────────┐
                                              ▼
 texte .prisma ──► core/prisma-parse.ts ──► Score (core/model.ts)
       ▲                                      │
       │             ┌────────────────────────┼────────────────────────┐
       │             ▼                        ▼                        ▼
       │      core/layout.ts         app/performance.ts         core/layout.ts
       │      (mesures en mm)         (le déroulé joué)         (en caractères)
       │             │                        │                        │
       │             ▼                        ▼                        ▼
       │      app/engrave.ts            app/player.ts        core/prisma-write.ts
       │        (pages A4)                 (smplr)                     │
       │             │                                                 │
       │             ▼                                                 │
       │     app/PageView.tsx                                          │
       │      (pages en SVG)                                           │
       └───────────────────────────────────────────────────────────────┘
```

### Le modèle (`core/model.ts`)

Un morceau lu est un `Score` : ses parties et portées, ses temps, ses notes, et tout ce qui les accompagne (petites notes, nuances, soufflets, liaisons, pédale, paroles, accords, sections et ordre de jeu). Il ne sait rien de la mise en page.

Le temps se compte en **ticks** depuis le début du morceau, avec une valeur fixe par temps, `TICKS_PER_BEAT = 2880`, quelle que soit la mesure : le temps d'un 4/4 et celui d'un 6/8 valent tous deux 2880. Ce nombre est divisible par 2⁶, 3² et 5 : doubles croches, triolets dans une mesure composée et quintolets tombent sur des valeurs entières, sans fraction ni arrondi.

Une note est une hauteur MIDI ; le nombre Prisma (1 à 12) et le couloir d'octave (`0` pour celle du do central) s'en déduisent (`core/pitch.ts`).

Une partie de guitare ou de basse a ses **cordes** (`Part.strings`, `core/strings.ts`) : leur accordage et le capo. Ses couloirs sont alors des cordes, et ses nombres des cases. Chaque note garde sa hauteur MIDI, pour l'écoute et l'export, et porte en plus sa corde (`Note.string`) : le choix de la corde est écrit dans le texte, il ne se déduit pas. La case se recalcule (la hauteur, moins la corde à vide et le capo). Un MusicXML importé avec sa tablature (une portée en clé `TAB`) garde ses cordes, et la partition classique qui la double est laissée de côté ; seul un MusicXML sans tablature reçoit des cordes choisies par l'application, par le doigté de la conversion. La conversion (`core/convert.ts`, Partition › Convertir pour la guitare ou la basse…) fait d'une partie quelconque une partie à cordes : ses portées réunies, ses notes rendues jouables (octave voisine, accords réduits), puis mises sur des cordes par le doigté le moins coûteux sur tout le morceau (`fingerStrings`, une programmation dynamique sur les attaques).

### La lecture (`core/prisma-parse.ts`)

Le texte se lit système par système. Les sauts de ligne sont libres : l'instant de chaque note se reconstitue à partir des règles de comptage, si bien qu'un même morceau peut s'écrire à n'importe quelle largeur. Une erreur est une `PrismaError` qui porte sa ligne et sa colonne.

Le lecteur s'arrête à la première erreur. Pour l'éditeur, `core/errors.ts` les trouve toutes en une passe : il met de côté le système fautif et relit la suite, sans rapporter les erreurs qui ne sont que des suites de la première. L'en-tête (`core/frontmatter.ts`) est un petit sous-ensemble de YAML, une clé par ligne, lu sans dépendance.

### La mise en page (`core/layout.ts`)

Le cœur du projet. Le moteur découpe le morceau en **systèmes** qui tiennent dans une largeur donnée, puis calcule pour chacun ses colonnes, ses lignes et le contenu de chaque case. Il ne connaît que des unités de largeur, et c'est volontaire : on lui donne des mesures en **caractères** pour écrire le texte (`core/prisma-write.ts`), en **millimètres** pour graver la partition (`app/engrave.ts`). Le texte et la partition sortent donc du même calcul : ils ont les mêmes systèmes, les mêmes alignements, et ne peuvent pas diverger.

### La gravure (`app/engrave.ts`, `app/PageView.tsx`)

`engrave` place les systèmes sur des pages A4 (toutes les dimensions en millimètres), et `PageView` les dessine en SVG avec React. Le même dessin sert à l'écran, à l'impression (une page gravée tient exactement sur une feuille), aux aperçus de la bibliothèque et aux exemples de la référence et du site. La couleur ne porte jamais seule l'information : la partition reste lisible imprimée en noir et blanc.

### L'écoute (`app/performance.ts`, `app/player.ts`)

`performance.ts` déroule le morceau tel qu'il se joue : reprises et ordre des sections, puis chaque note placée sur ce déroulé. Il y a donc deux échelles de temps : l'instant du morceau (sa place sur la partition) et l'instant joué (depuis le début de l'écoute) ; une mesure reprise a un instant du morceau et deux instants joués. Les nuances deviennent des intensités (`dynamics.ts`), la pédale allonge les notes qu'elle tient (`pedal.ts`) ; petites notes, trilles, arpèges, points d'orgue et articulations sont réalisés au même endroit.

`player.ts` joue ce déroulé avec [smplr](https://github.com/danigb/smplr) : un piano échantillonné, et des sons General MIDI pour les autres instruments, chargés à la première écoute qui les demande. Il publie l'instant joué ; la partition s'en sert pour son curseur, et la suit (`follow.ts`, `glide.ts`). Le métronome est un son enregistré (CC0) fourni avec l'application.

### L'import MusicXML (`core/musicxml.ts`)

Un MusicXML « score-partwise » devient un `Score`, que `writePrisma` écrit aussitôt en texte : c'est ce texte qu'on retrouve dans l'éditeur, et c'est lui qui est ensuite lu pour graver et jouer, comme un `.prisma` ouvert (`app/render.ts`). Le texte reste ainsi la seule source, même pour un morceau importé. La structure est d'abord déroulée (reprises, cases, D.C., D.S., coda, Fine), puis redécoupée en sections et en ordre de jeu : Prisma ne garde que des reprises simples. Les liaisons de prolongation sont fusionnées, les mesures composées comptées en temps pointés, les instruments transpositeurs ramenés à la hauteur qui sonne.

### L'export MusicXML (`core/musicxml-export.ts`)

Le chemin inverse, pour ouvrir un morceau dans MuseScore ou un autre logiciel (Fichier › Exporter en MusicXML…, ou l'outil en ligne de commande). La partition classique demande ce que Prisma a retiré, et l'export le reconstitue : le nom des notes et l'armure d'après la tonalité (`key`, ou celle que les notes font deviner) ; les figures de durée, une note qui passe une barre ou qu'aucune figure ne rend devenant des notes liées, un temps coupé en 3 (5, 6, 7) un triolet (un quintolet…) ; les voix, des notes de même début et même fin formant un accord ; la clé de chaque portée, d'après ses notes ; une partie de guitare ou de basse, en partition et en tablature (une portée en clé `TAB`, avec son accordage, son capo, la corde et la case de chaque note). Les reprises s'écrivent en barres de reprise. Un ordre de jeu, que MusicXML ne sait pas dire, est déroulé, chaque section marquée de sa lettre (un repère de répétition) ; en option (la fenêtre de l'export, ou `--reprises`), il s'écrit quand c'est possible en reprises et en cases 1 et 2, comme une partition classique (avec ou sans la lettre de chaque section), et se déroule pour le reste. Dans les deux cas, l'import retrouve l'ordre : une section dont le repère revient avec les mêmes mesures n'est gardée qu'une fois, et l'on retrouve sections et ordre. Le fichier suit le schéma MusicXML 4.0.

## L'application (`src/app/`)

`App.tsx` assemble l'ensemble : la barre et ses menus, l'éditeur à gauche, les pages à droite, la bibliothèque, la référence, les options.

- **L'éditeur** (`SourceEditor.tsx`) est CodeMirror 6. Sa coloration (`sourceColors.ts`) est un `ViewPlugin` plutôt qu'une grammaire : le format est fait de colonnes alignées, plus simple à lire ligne à ligne qu'à décrire par une grammaire. Les erreurs viennent de `parseErrors`, soulignées par le `linter` de CodeMirror. La barre de statut dit ce que pointe le curseur (`core/inspect.ts`).
- **La complétion** (`completion.ts`) propose ce qui peut s'écrire à la place du curseur ; `complete.ts` l'écrit sans casser l'alignement, en élargissant au besoin une case sur toutes les lignes du système.
- **De la partition au texte** : un clic sur la partition place le curseur sur le signe cliqué (`core/locate.ts`), et le signe sous le curseur est encadré sur la partition (`textMark.ts`). La partition refait ses propres systèmes, le texte a les siens : un signe s'y retrouve par son instant, sa portée, son octave et ce qui est écrit dans sa case, le texte étant relu avec indulgence.
- **La retouche sur place** (`retouch.ts`, `RetouchMenu.tsx`) : un double-clic sur une case change sa note, sa durée, son octave, ses ajouts ; sur une corde, sa case (de 0 à 24, chacune nommée), sa durée si la corde est libre, et sa corde : une autre corde choisie montre ses cases (celle du même son marquée), et la case choisie y place la note, avec ses tenues ; comme sur l'instrument, elle coupe ce qui sonnait encore sur cette corde et s'arrête à la note suivante. La retouche est une réécriture du texte, comme une frappe : Ctrl+Z la défait.
- **Les fichiers** (`files.ts`, `library.ts`) : avec Chrome et Edge, l'API File System Access réécrit le fichier ouvert et donne accès à un dossier de morceaux, la bibliothèque. Ailleurs, on ouvre par le sélecteur de fichiers et on enregistre par un téléchargement. Rien n'est copié dans le navigateur : le disque reste la seule référence.
- **Les réglages** : les options générales sont gardées dans le navigateur (`options.ts`) ; celles d'un morceau (tempo, portées muettes, rendu) dans un fichier `.json` à côté de lui (`piece.ts`), pour que la partition reste propre à diffuser.
- **Les aperçus** de la bibliothèque sont gravés dans un worker (`thumbs.worker.ts`) et gardés en cache (`thumbs.ts`).
- **La référence** (`ReferenceView.tsx`) affiche `REFERENCE.md` : chaque exemple ` ```prisma ` y est gravé par le vrai moteur. Elle ne peut donc pas montrer une gravure périmée.

## Le site (`src/site/`)

Quatre pages à la racine (`index.html`, `apprendre.html`, `reference.html`, `comparaison.html`), l'application dans `app/`. Le site est construit avec l'application, dans le même `vite build`, et réutilise ses composants : chaque exemple est gravé par le moteur, et la page Référence est le composant de l'application. `Example.tsx` montre au choix la partition ou le texte d'un exemple, copiable d'un clic. Les liens du site vers une partie de la référence (`referenceLinks.ts`) sont vérifiés par un test.

## Choix techniques

- **TypeScript partout, sans étape de compilation pour le code Node** : les types sont « effaçables » (`erasableSyntaxOnly`), si bien que Node exécute directement l'outil en ligne de commande.
- **`core/` ne dépend de rien d'autre** : ni de React, ni du navigateur. Il sert à l'application, au site, à l'outil en ligne de commande et aux tests.
- **Peu de dépendances** : React, CodeMirror, smplr (le son), fast-xml-parser (MusicXML), marked (la référence). L'en-tête, la mise en page et la gravure sont faits à la main.
- **Le texte est la source** : la partition, l'écoute, la barre de statut et la retouche en découlent. La retouche écrit dans le texte, elle ne modifie jamais la partition directement.
- **Pas de compatibilité ascendante** : quand le format change, l'ancienne écriture n'est plus lue. La version du format est écrite dans l'en-tête (`format: 1`).
- **Un signe, un sens** : dans le format, un signe ne veut dire qu'une chose. C'est ce qui guide le choix de chaque nouveau signe.

## Tests

`npm test` lance Vitest sur `tests/`. L'essentiel est dans `core.test.ts`, organisé par sujet : règles du format, reprises et sections, import MusicXML (avec la Gymnopédie n° 1 de Satie en exemple), nuances, pédale, ornements, accords, paroles, et l'écoute (déroulé, intensités, métronome…). `export.test.ts` fait l'aller-retour de l'export : la Gymnopédie et chaque exemple de la référence, exportés puis réimportés, redonnent les mêmes notes, les mêmes indications, les mêmes sections et le même ordre de jeu. `strings.test.ts` couvre les instruments à cordes : cordes et cases, accordage et capo, erreurs, parties mêlées, import, export, conversion. Les autres fichiers couvrent les erreurs en une passe, la complétion, le chemin de la partition au texte, la retouche et les réglages d'un morceau.

`reference.test.ts` vérifie chaque exemple de la référence : il doit se lire sans erreur et être écrit exactement comme l'application l'écrirait. La documentation ne peut donc pas montrer un exemple faux ou mal mis en forme.

## Contribuer

- Lancez `npm run typecheck` et `npm test` avant de proposer un changement.
- Un changement du format se reporte dans [FORMAT.md](FORMAT.md) (la grammaire exacte) et dans [REFERENCE.md](REFERENCE.md) (pour le musicien), avec un exemple quand c'est utile : le test de la référence le vérifiera.
- Le code, ses commentaires et la documentation sont en français ; les clés de l'en-tête et les noms d'instruments sont en anglais, comme les noms d'accords.
- Les messages de commit sont en anglais, au format conventionnel : `feat(editor): …`, `fix(app): …`, avec si besoin une liste de tirets.
- Les fichiers sont en UTF-8, avec des fins de ligne LF.
- Les textes destinés à l'utilisateur, dans l'application comme sur le site, le vouvoient.
