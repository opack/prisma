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
npm run visual     # le banc de captures (Playwright), voir Tests
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
       │             ┌────────────────────────┼───────────────────────────┐
       │             ▼                        ▼                           ▼
       │      core/layout.ts     app/playback/performance.ts       core/layout.ts
       │      (mesures en mm)         (le déroulé joué)            (en caractères)
       │             │                        │                           │
       │             ▼                        ▼                           ▼
       │   app/score/engrave.ts    app/playback/player.ts       core/prisma-write.ts
       │        (pages A4)                 (smplr)                        │
       │             │                                                    │
       │             ▼                                                    │
       │  app/score/PageView.tsx                                          │
       │      (pages en SVG)                                              │
       └──────────────────────────────────────────────────────────────────┘
```

### Le modèle (`core/model.ts`)

Un morceau lu est un `Score` : ses parties et portées, ses temps, ses notes, et tout ce qui les accompagne (petites notes, nuances, soufflets, liaisons, pédale, paroles, accords, sections et ordre de jeu). Il ne sait rien de la mise en page.

Le temps se compte en **ticks** depuis le début du morceau, avec une valeur fixe par temps, `TICKS_PER_BEAT = 2880`, quelle que soit la mesure : le temps d'un 4/4 et celui d'un 6/8 valent tous deux 2880. Ce nombre est divisible par 2⁶, 3² et 5 : doubles croches, triolets dans une mesure composée et quintolets tombent sur des valeurs entières, sans fraction ni arrondi.

Une note est une hauteur MIDI ; le nombre Prisma (1 à 12) et le couloir d'octave (`0` pour celle du do central) s'en déduisent (`core/pitch.ts`).

Une partie de guitare ou de basse a ses **cordes** (`Part.strings`, `core/strings.ts`) : leur accordage et le capo. Ses couloirs sont alors des cordes, et ses nombres des cases. Chaque note garde sa hauteur MIDI, pour l'écoute et l'export, et porte en plus sa corde (`Note.string`) : le choix de la corde est écrit dans le texte, il ne se déduit pas. La case se recalcule (la hauteur, moins la corde à vide et le capo). Un MusicXML importé avec sa tablature (une portée en clé `TAB`) garde ses cordes, et la partition classique qui la double est laissée de côté ; seul un MusicXML sans tablature reçoit des cordes choisies par l'application, par le doigté de la conversion. Les techniques des cordes sont des champs de la note (`dead`, `harmonic`, `slide`, `bend`, `release`), le médiator une articulation (`down`, `up`), l'étouffé de la paume et le vibrato des `Effect` d'une voix, qui durent comme un soufflet ; à l'écoute, `performance.ts` les change en notes que les sons savent jouer. Les grilles d'accords de la ligne `@c` (`core/shapes.ts`) : écrites après le nom (`10:m=x02210`), ou cherchées, la plus simple qui joue l'accord sur la guitare du morceau. La conversion (`core/convert.ts`, Partition › Convertir pour la guitare ou la basse…) fait d'une partie quelconque une partie à cordes : ses portées réunies, ses notes rendues jouables (octave voisine, accords réduits), puis mises sur des cordes par le doigté le moins coûteux sur tout le morceau (`fingerStrings`, une programmation dynamique sur les attaques).

### La lecture (`core/prisma-parse.ts`)

Le texte se lit système par système. Les sauts de ligne sont libres : l'instant de chaque note se reconstitue à partir des règles de comptage, si bien qu'un même morceau peut s'écrire à n'importe quelle largeur. Une erreur est une `PrismaError` qui porte sa ligne et sa colonne.

Le lecteur s'arrête à la première erreur. Pour l'éditeur, `core/errors.ts` les trouve toutes en une passe : il met de côté le système fautif et relit la suite, sans rapporter les erreurs qui ne sont que des suites de la première. L'en-tête (`core/frontmatter.ts`) est un petit sous-ensemble de YAML, une clé par ligne, lu sans dépendance.

### La mise en page (`core/layout.ts`)

Le cœur du projet. Le moteur découpe le morceau en **systèmes** qui tiennent dans une largeur donnée, puis calcule pour chacun ses colonnes, ses lignes et le contenu de chaque case. Il ne connaît que des unités de largeur, et c'est volontaire : on lui donne des mesures en **caractères** pour écrire le texte (`core/prisma-write.ts`), en **millimètres** pour graver la partition (`app/engrave.ts`). Le texte et la partition sortent donc du même calcul : ils ont les mêmes systèmes, les mêmes alignements, et ne peuvent pas diverger.

### La gravure (`app/score/engrave.ts`, `app/score/PageView.tsx`)

`engrave` place les systèmes sur des pages A4 (toutes les dimensions en millimètres), et `PageView` les dessine en SVG avec React. Le même dessin sert à l'écran, à l'impression (une page gravée tient exactement sur une feuille), aux aperçus de la bibliothèque et aux exemples de la référence et du site. La couleur ne porte jamais seule l'information : la partition reste lisible imprimée en noir et blanc.

### L'écoute (`app/playback/performance.ts`, `app/playback/player.ts`)

`performance.ts` déroule le morceau tel qu'il se joue : reprises et ordre des sections, puis chaque note placée sur ce déroulé. Il y a donc deux échelles de temps : l'instant du morceau (sa place sur la partition) et l'instant joué (depuis le début de l'écoute) ; une mesure reprise a un instant du morceau et deux instants joués. Les nuances deviennent des intensités (`dynamics.ts`), la pédale allonge les notes qu'elle tient (`pedal.ts`) ; petites notes, trilles, arpèges, points d'orgue et articulations sont réalisés au même endroit.

`playedBars` en tire les mesures dans l'ordre où elles se jouent, pour la piste de lecture (`Progress.tsx`, sous la barre) : où en est la lecture, en mesures et en temps, et s'y placer. `player.ts` joue ce déroulé avec [smplr](https://github.com/danigb/smplr) : un piano échantillonné, et des sons General MIDI pour les autres instruments, chargés à la première écoute qui les demande. Il publie l'instant joué ; la partition s'en sert pour son curseur, et la suit (`follow.ts`, `glide.ts`). Le métronome est un son enregistré (CC0) fourni avec l'application.

### L'import MusicXML (`core/musicxml.ts`)

Un MusicXML « score-partwise » devient un `Score`, que `writePrisma` écrit aussitôt en texte : c'est ce texte qu'on retrouve dans l'éditeur, et c'est lui qui est ensuite lu pour graver et jouer, comme un `.prisma` ouvert (`app/render.ts`). Le texte reste ainsi la seule source, même pour un morceau importé. La structure est d'abord déroulée (reprises, cases, D.C., D.S., coda, Fine), puis redécoupée en sections et en ordre de jeu : Prisma ne garde que des reprises simples. Les liaisons de prolongation sont fusionnées, les mesures composées comptées en temps pointés, les instruments transpositeurs ramenés à la hauteur qui sonne.

### L'export MusicXML (`core/musicxml-export.ts`)

Le chemin inverse, pour ouvrir un morceau dans MuseScore ou un autre logiciel (Fichier › Exporter en MusicXML…, ou l'outil en ligne de commande). La partition classique demande ce que Prisma a retiré, et l'export le reconstitue : le nom des notes et l'armure d'après la tonalité (`key`, ou celle que les notes font deviner) ; les figures de durée, une note qui passe une barre ou qu'aucune figure ne rend devenant des notes liées, un temps coupé en 3 (5, 6, 7) un triolet (un quintolet…) ; les voix, des notes de même début et même fin formant un accord ; la clé de chaque portée, d'après ses notes ; une partie de guitare ou de basse, en partition et en tablature (une portée en clé `TAB`, avec son accordage, son capo, la corde et la case de chaque note). Les reprises s'écrivent en barres de reprise. Un ordre de jeu, que MusicXML ne sait pas dire, est déroulé, chaque section marquée de sa lettre (un repère de répétition) ; en option (la fenêtre de l'export, ou `--reprises`), il s'écrit quand c'est possible en reprises et en cases 1 et 2, comme une partition classique (avec ou sans la lettre de chaque section), et se déroule pour le reste. Dans les deux cas, l'import retrouve l'ordre : une section dont le repère revient avec les mêmes mesures n'est gardée qu'une fois, et l'on retrouve sections et ordre. Le fichier suit le schéma MusicXML 4.0.

## L'application (`src/app/`)

`App.tsx` assemble l'ensemble : la barre (`Toolbar`, ses menus dans `menus.ts`), l'éditeur à gauche, les pages à droite, la bibliothèque, la référence, les options ; il ne tient que les panneaux ouverts et le mode, et branche ce que chaque domaine tient, en hooks : le morceau ouvert et son fichier (`files/useDocument`), les réglages (`options/useSettings`), la vue de la partition (`score/useView`, `usePreviewScroll`, `useTextMark`), l'écoute du morceau (`playback/usePieceSound`), la retouche (`retouch/useRetouch`), les erreurs et la conversion (`editor/useErrors`, `useConversion`), les raccourcis (`useShortcuts`). Le reste est rangé par domaine : `editor/` (l'éditeur, la complétion, la conversion pour la guitare, la languette, la barre de glissé, la barre des erreurs), `score/` (la gravure, les pages, la lecture focalisée), `playback/` (l'écoute, le métronome), `retouch/`, `files/` (Nouveau, Ouvrir et Enregistrer, l'export, le dépôt d'un fichier), `library/`, `options/`, `reference/`, et `ui/`, les éléments d'interface partagés.

- **L'éditeur** (`editor/SourceEditor.tsx`) est CodeMirror 6. Sa coloration (`sourceColors.ts`) est un `ViewPlugin` plutôt qu'une grammaire : le format est fait de colonnes alignées, plus simple à lire ligne à ligne qu'à décrire par une grammaire. Les erreurs viennent de `parseErrors`, soulignées par le `linter` de CodeMirror. La barre de statut dit ce que pointe le curseur (`core/inspect.ts`).
- **La complétion** (`editor/completion.ts`) propose ce qui peut s'écrire à la place du curseur ; `complete.ts` l'écrit sans casser l'alignement, en élargissant au besoin une case sur toutes les lignes du système.
- **De la partition au texte** : un clic sur la partition place le curseur sur le signe cliqué (`core/locate.ts`), et le signe sous le curseur est encadré sur la partition (`score/textMark.ts`). La partition refait ses propres systèmes, le texte a les siens : un signe s'y retrouve par son instant, sa portée, son octave et ce qui est écrit dans sa case, le texte étant relu avec indulgence.
- **La retouche sur place** (`retouch/`) : un double-clic sur une case change sa note, sa durée, son octave, ses ajouts ; sur une corde, sa case (de 0 à 24, chacune nommée), sa durée si la corde est libre, et sa corde : une autre corde choisie montre ses cases (celle du même son marquée), et la case choisie y place la note, avec ses tenues ; comme sur l'instrument, elle coupe ce qui sonnait encore sur cette corde et s'arrête à la note suivante. La retouche est une réécriture du texte, comme une frappe : Ctrl+Z la défait.
- **Les fichiers** (`files/files.ts`, `files/stored.ts`, `library/`) : avec Chrome et Edge, l'API File System Access réécrit le fichier ouvert et donne accès à un dossier de morceaux, la bibliothèque. Ailleurs, on ouvre par le sélecteur de fichiers et on enregistre par un téléchargement. Rien n'est copié dans le navigateur : le disque reste la seule référence. L'application ne connaît qu'un fichier et un dossier où qu'ils soient (`StoredFile`, `StoredFolder` : lire, réécrire, trouver un fichier par son nom) ; la bibliothèque, qu'une source (`LibrarySource` : son accès, ses fichiers), dont elle lit les titres et les réglages (`scan`). Le dossier du disque est la première source (`library/diskLibrary.ts`) ; un drive en ligne en sera une autre.
- **Le partage par un lien** (`files/share.ts`, `files/useShare.ts`, `files/ReceivedDialog.tsx`, `files/ImportLinkDialog.tsx`) : le morceau, son nom et ses réglages, en JSON compressé (`CompressionStream`, *deflate*) puis en base64 sans signe gênant, dans le fragment de l'adresse (`app/#p=…`), que le navigateur n'envoie jamais au serveur. Le lien est tenu prêt à chaque changement : Safari ne partage (`navigator.share`) et ne copie qu'aussitôt après le geste. Un lien s'ouvre, ou se colle (Fichier › Importer un lien) ; reçu, le morceau s'ouvre tel quel ou s'enregistre d'abord à la racine de la source de la bibliothèque.
- **Les réglages** : les options générales sont gardées dans le navigateur (`options/options.ts`) ; celles d'un morceau (tempo, portées muettes, instrument et volume de chaque partie, rendu) dans un fichier `.json` à côté de lui (`options/piece.ts`), pour que la partition reste propre à diffuser.
- **L'application installable et hors ligne** (PWA, `vite-plugin-pwa` dans `vite.config.ts`, `ui/useAppUpdate.ts`) : le manifeste, les icônes (`public/icons/`, tirées du logo) et un service worker, généré au build, qui garde le site et l'application (précache), puis les polices et les échantillons des instruments à leur premier usage (CacheFirst). Une nouvelle version attend qu'on la prenne : le bouton « Mettre à jour » de la barre. En développement (`npm run dev`, le banc), pas de service worker.
- **Les aperçus** de la bibliothèque sont gravés dans un worker (`library/thumbs.worker.ts`) et gardés en cache (`library/thumbs.ts`).
- **La référence** (`reference/ReferenceView.tsx`) affiche `REFERENCE.md` : chaque exemple ` ```prisma ` y est gravé par le vrai moteur. Elle ne peut donc pas montrer une gravure périmée. Ses liens vers une page du site s'ouvrent dans un nouvel onglet, sans quitter le morceau.

## Le site (`src/site/`)

Cinq pages à la racine (`index.html`, `apprendre.html`, `reference.html`, `guitare.html`, `comparaison.html`), l'application dans `app/`. Le site est construit avec l'application, dans le même `vite build`, et réutilise ses composants : chaque exemple est gravé par le moteur, et la page Référence est le composant de l'application. Les pages sont dans `pages/`, ce qui les met en forme (le haut et le bas, les idées, « Sur cette page », les boutons) dans `layout/`, les exemples et leurs morceaux dans `examples/`. `examples/Example.tsx` montre au choix la partition ou le texte d'un exemple, copiable d'un clic. Les liens du site vers une partie de la référence (`pages/referenceLinks.ts`) sont vérifiés par un test.

## Choix techniques

- **TypeScript partout, sans étape de compilation pour le code Node** : les types sont « effaçables » (`erasableSyntaxOnly`), si bien que Node exécute directement l'outil en ligne de commande.
- **`core/` ne dépend de rien d'autre** : ni de React, ni du navigateur. Il sert à l'application, au site, à l'outil en ligne de commande et aux tests.
- **Peu de dépendances** : React, CodeMirror, smplr (le son), fast-xml-parser (MusicXML), marked (la référence), Tailwind (les styles), React Aria Components (le comportement des menus et des petits panneaux : le clavier, le focus, Échap et le clic ailleurs, une place tenue dans l'écran ; sans style, les classes de Tailwind s'y posent). L'en-tête, la mise en page et la gravure sont faits à la main.
- **Les styles en classes Tailwind**, posées sur les composants, avec des couleurs et des polices communes à l'application et au site (`src/tailwind.css` : `text-ink`, `bg-panel`, `border-line`, `text-accent`, `font-mono`…, une seule palette, dans `@theme` ; pour le CSS qui reste, `var(--color-ink)`…) ; ce que plusieurs écrans partagent est un composant, qui porte son style, un par fichier (sa cuisine interne, non exportée, avec lui), une famille par répertoire : dans `app/ui/`, `dialog/` (`Dialog`, `Choices`, `SelectField`…), `popover/` (`Popover`, `PopoverChoices`…), `keyboard/`, `button/` (`Button`, au trait, plein ou discret, à bascule, en texte ou en icône ; `ButtonGroup`, des boutons collés ; les retours), `menu/` (`MenuBar` : la barre des menus, qu'on parcourt au survol et aux flèches ; un seul « Menu » quand la place manque, où un titre choisi montre ses actions à la place des titres), `Logo` (le logo, `public/icons/logo.svg`, qui sert aussi d'icône aux onglets), `ContentsMenu` (les parties d'une page sous un bouton : la référence sur un écran étroit, les pages du site) ; dans `site/layout/`, `Page`, `Section`, `PartsBar`, `Prisma` (l'écriture Prisma dans le texte), `ButtonLink`, `Idea`, `Caption`… Le CSS qui reste vit avec son composant : le thème de l'éditeur dans `EditorView.theme` (CodeMirror le limite à l'éditeur), la page gravée et son impression dans `score/page.css` (sa taille dépend de l'ajustement de la partition, l'impression passe par `@page`), la référence, du Markdown rendu, reçoit ses classes de son rendu (`reference/markdown.ts`) ; la mise en page de la vue principale (l'éditeur ou la partition, le glissé de la barre, le repli sur un écran étroit) et le tableau de la comparaison sont en classes. Le CSS est rangé en couches (`@layer theme, base, components, utilities`) : les classes de Tailwind passent par-dessus, sans `!important`. Le *preflight* de Tailwind remet les éléments à zéro ; la couche `base` ne redonne que ce qui sert partout : le gras des titres, la main sur ce qui se clique, et, pour le texte courant (la référence, les pages du site), les paragraphes, les liens soulignés et les listes. L'allure des boutons est celle du composant `Button`, l'écriture Prisma celle du composant `Prisma`. La page elle-même (sa police, ses couleurs, sa hauteur) est dans les classes de `<body>`. Le contour du clavier d'un bouton est celui que décide React Aria (`useFocusRing` : au clavier, pas après un clic). Une classe de CSS ne doit pas porter le nom d'une classe de Tailwind (`fixed`, `hidden`…) : Tailwind la prendrait pour la sienne.
- **Le texte est la source** : la partition, l'écoute, la barre de statut et la retouche en découlent. La retouche écrit dans le texte, elle ne modifie jamais la partition directement.
- **Pas de compatibilité ascendante** : quand le format change, l'ancienne écriture n'est plus lue. La version du format est écrite dans l'en-tête (`format: 1`).
- **Un signe, un sens** : dans le format, un signe ne veut dire qu'une chose. C'est ce qui guide le choix de chaque nouveau signe.

## Tests

`npm test` lance Vitest sur `tests/`. L'essentiel est dans `core.test.ts`, organisé par sujet : règles du format, reprises et sections, import MusicXML (avec la Gymnopédie n° 1 de Satie en exemple), nuances, pédale, ornements, accords, paroles, et l'écoute (déroulé, intensités, métronome…). `export.test.ts` fait l'aller-retour de l'export : la Gymnopédie et chaque exemple de la référence, exportés puis réimportés, redonnent les mêmes notes, les mêmes indications, les mêmes sections et le même ordre de jeu. `strings.test.ts` couvre les instruments à cordes : cordes et cases, accordage et capo, erreurs, parties mêlées, import, export, conversion. `techniques.test.ts` couvre les techniques des cordes : leur écriture, leurs erreurs, l'écoute, MusicXML. `shapes.test.ts` couvre les grilles d'accords : leur écriture, les formes choisies, le capo et l'accordage, les erreurs, MusicXML. Les autres fichiers couvrent les erreurs en une passe, la complétion, le chemin de la partition au texte, la retouche et les réglages d'un morceau.

`reference.test.ts` vérifie chaque exemple de la référence : il doit se lire sans erreur et être écrit exactement comme l'application l'écrirait. La documentation ne peut donc pas montrer un exemple faux ou mal mis en forme.

Le banc de captures (`npm run visual`, Playwright, `tests/visual/`) photographie chaque page du site (au bureau et sur un téléphone), les écrans et panneaux de l'application (au bureau, et quelques-uns sur une tablette et un téléphone), et la gravure d'un petit corpus, en impression comprise, et compare chaque capture pixel à pixel à sa référence. Il sert aux refontes qui ne doivent rien changer à l'œil : les références se prennent sur le code de départ, dans un `git worktree` à côté, puis le code modifié s'y compare.

```sh
npx playwright install chromium                    # une fois
git worktree add ../prisma-reference HEAD          # le code de départ (npm install dedans)
VISUAL_ROOT=../prisma-reference npm run visual:reference
npm run visual                                     # les écarts : test-results/visual-report
```

Sous PowerShell : `$env:VISUAL_ROOT = "../prisma-reference"; npm run visual:reference`, puis `Remove-Item Env:VISUAL_ROOT`. Les captures et les écarts restent hors du dépôt.

## Contribuer

- Lancez `npm run typecheck` et `npm test` avant de proposer un changement.
- Un changement du format se reporte dans [FORMAT.md](FORMAT.md) (la grammaire exacte) et dans [REFERENCE.md](REFERENCE.md) (pour le musicien), avec un exemple quand c'est utile : le test de la référence le vérifiera.
- Le code, ses commentaires et la documentation sont en français ; les clés de l'en-tête et les noms d'instruments sont en anglais, comme les noms d'accords.
- Les messages de commit sont en anglais, au format conventionnel : `feat(editor): …`, `fix(app): …`, avec si besoin une liste de tirets.
- Les fichiers sont en UTF-8, avec des fins de ligne LF.
- Les textes destinés à l'utilisateur, dans l'application comme sur le site, le vouvoient.
