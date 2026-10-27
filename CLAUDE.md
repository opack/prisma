# Prisma : les règles du projet

Le projet est décrit dans [README.md](README.md) (architecture, choix techniques, tests), le format dans [FORMAT.md](FORMAT.md), la notation pour le musicien dans [REFERENCE.md](REFERENCE.md), les chantiers dans [ROADMAP.md](ROADMAP.md).

## Langue et écriture

- Le code, ses commentaires et la documentation sont en français ; les clés de l'en-tête, les noms d'instruments et les noms d'accords sont en anglais.
- Les textes de l'application et du site vouvoient.
- Dans un texte, les noms de notes sont en italique (*do*, *fa dièse*) ; l'écriture Prisma est en code (`7`, `10:m`).
- Les messages de commit sont en anglais, au format conventionnel (`feat(editor): …`, `fix(app): …`, `refactor: …`), avec si besoin une liste de tirets ; sans mention de co-auteur.
- Les fichiers sont en UTF-8, avec des fins de ligne LF. Pas de Prettier.

## Le format

- Un signe, un sens : un signe ne veut dire qu'une chose.
- Pas de compatibilité ascendante : l'ancienne écriture n'est plus lue.
- Un changement du format se reporte dans FORMAT.md et REFERENCE.md, avec un exemple (le test de la référence le vérifie).

## Les styles : Tailwind

- Les styles s'écrivent en classes Tailwind, sur les éléments, avec les couleurs et les polices du thème (`src/tailwind.css` : `text-ink`, `text-muted`, `bg-panel`, `border-line`, `text-accent`, `bg-accent-12`, `font-mono`…). Pas de nouvelle règle CSS écrite à la main.
- Le CSS qui reste vit avec son composant : le thème de CodeMirror dans l'éditeur (`EditorView.theme`), la page gravée et son impression (`score/page.css`, importé par PageView) ; la référence, du Markdown rendu, reçoit ses classes de son rendu (`reference/markdown.ts`) ; plus le thème et les variantes (`src/tailwind.css`) et le texte courant du site (`site/site.css`). Pas de feuille de style commune à l'application.
- La couche `base` ne garde que les éléments par défaut qui servent partout (les titres, la main sur ce qui se clique, le texte courant) ; la page (police, couleurs) est dans les classes de `<body>`. Pas de rattrapage du *preflight* au pixel : un écart s'accepte, ou se corrige d'une classe là où il gêne.
- Les couleurs et les polices : une seule palette, dans le `@theme` de `src/tailwind.css` ; en CSS, `var(--color-ink)`, `var(--font-mono)`.
- Deux classes qui règlent la même propriété ne vont pas sur le même élément : on choisit par une condition (`on ? "border-accent" : "border-line"`).
- Une classe CSS ne porte jamais le nom d'une classe Tailwind (`fixed`, `hidden`, `block`…) : Tailwind la prendrait pour la sienne.
- Les écrans étroits : `narrow:` (900 px) et `phone:` (600 px) ; pour la barre d'outils de l'application, `compact:` (1000 px, un seul menu) et `stacked:` (720 px, l'écoute sur sa ligne).
- L'impression en noir et blanc doit rester lisible.

## Les composants

- Un composant exposé par fichier ; ce qui ne sert qu'à lui (sous-composants, constantes de classes) reste dans son fichier, sans être exporté.
- Ce que plusieurs écrans partagent est un composant, qui porte son style, jamais une constante de classes partagée. Un composant reçoit au plus un `className` pour sa place (ses marges, sa position), que décide ce qui l'entoure.
- Plutôt que d'exposer un sous-composant, le composant reçoit ses données (`<Choices options={…} />`).
- La barre des menus de l'application : `MenuBar` (`app/ui/menu/`), un menu ouvert passe à l'autre au survol et aux flèches ; quand la place manque, un seul « Menu », où un titre choisi montre ses actions à la place des titres (« ‹ Menu » y revient).
- Un menu, un petit panneau, un choix qui s'ouvre : sur React Aria Components (`MenuTrigger`, `DialogTrigger`, `Popover`…), pour le clavier, le focus, Échap, le clic ailleurs et la place dans l'écran. Son bouton est le nôtre, dans un `Pressable`.
- Un bouton est un `Button` (`app/ui/button/`), avec son genre (`kind`), sa taille (`size`), allumé ou non (`pressed`) ; des boutons collés, un `ButtonGroup`. Un `<button>` à la main seulement pour ce qui n'a pas l'air d'un bouton (une touche du clavier, un morceau de la bibliothèque, un onglet).
- L'écriture Prisma dans le texte du site : le composant `Prisma`.
- Les fichiers sont rangés par domaine : dans `src/app/`, `editor/`, `score/`, `playback/`, `files/`, `library/`, `options/`, `retouch/`, `reference/`, et `ui/` pour les éléments d'interface partagés (`dialog/`, `popover/`, `keyboard/`, `button/`, `menu/`) ; dans `src/site/`, `pages/`, `layout/`, `examples/`. Une famille de composants a son répertoire.
- `core/` ne dépend ni de React ni du navigateur.
- `App.tsx` assemble, il ne fait pas : la logique d'un domaine va dans un hook de ce domaine (`files/useDocument`, `retouch/useRetouch`…), un morceau d'écran dans un composant.

## Vérifier avant de dire que c'est fait

- `npm run typecheck`, `npm test` et `npm run build` passent.
- Le banc de captures (`npm run visual`) passe. Un changement voulu de l'apparence se vérifie sur les écarts, puis met à jour les références (`--update-snapshots`, pour les seules scènes concernées) ; jamais pour faire taire un écart qu'on ne comprend pas.
- Un écran, un panneau ou un état nouveau a sa scène dans le banc (`tests/visual/visual.pw.ts`), et une logique nouvelle ses tests (`tests/`).
- Un chantier fini passe dans « Fait » de la ROADMAP ; le README suit l'architecture.
