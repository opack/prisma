# Prisma : les règles du projet

Le projet est décrit dans [README.md](README.md) (architecture, choix techniques, tests), le format dans [FORMAT.md](FORMAT.md), la notation pour le musicien dans [REFERENCE.md](REFERENCE.md), les chantiers dans [ROADMAP.md](ROADMAP.md).

## Langue et écriture

- Le code, ses commentaires et la documentation sont en français ; les clés de l'en-tête, les noms d'instruments et les noms d'accords sont en anglais.
- Les textes de l'application et du site vouvoient.
- Dans un texte, les noms de notes sont en italique (*do*, *fa dièse*) ; l'écriture Prisma est en code (`7`, `10:m`).
- Les messages de commit sont en anglais, au format conventionnel (`feat(editor): …`, `fix(app): …`, `refactor: …`), avec si besoin une liste de tirets ; sans mention de co-auteur.
- Les fichiers sont en UTF-8, avec des fins de ligne LF. Prettier les met en forme (`pnpm format`), sauf le Markdown, écrit à la main.

## La version

- La version suit semver, dans `package.json` : un changement que l'utilisateur voit la monte dans sa PR, le dernier nombre pour une correction, celui du milieu pour une nouveauté.
- Il ajoute ses lignes en tête de `CHANGELOG.md`, sous `## <version> — <date en toutes lettres>` : ce qui change pour le musicien, en une ligne chacun, vouvoyé, sans jargon de code. Un test vérifie que la première version du fichier est celle de `package.json`.

## Le format

- Un signe, un sens : un signe ne veut dire qu'une chose.
- Pas de compatibilité ascendante : l'ancienne écriture n'est plus lue.
- Un changement du format se reporte dans FORMAT.md et REFERENCE.md, avec un exemple (le test de la référence le vérifie).

## Les styles : Tailwind

- Les styles s'écrivent en classes Tailwind, sur les éléments, avec les couleurs et les polices du thème (`src/tailwind.css` : `text-ink`, `text-dim`, `bg-panel`, `border-line`, `text-brand`, `bg-brand-12`, `font-mono`…). Pas de nouvelle règle CSS écrite à la main.
- Le CSS qui reste vit avec son composant : le thème de CodeMirror dans l'éditeur (`EditorView.theme`), la page gravée et son impression (`score/page.css`, importé par PageView) ; la référence, du Markdown rendu, reçoit ses classes de son rendu (`reference/markdown.ts`) ; plus le thème et les variantes (`src/tailwind.css`) et le texte courant du site (`site/site.css`). Pas de feuille de style commune à l'application.
- La couche `base` ne garde que les éléments par défaut qui servent partout (les titres, la main sur ce qui se clique, le texte courant) ; la page (police, couleurs) est dans les classes de `<body>`. Pas de rattrapage du *preflight* au pixel : un écart s'accepte, ou se corrige d'une classe là où il gêne.
- Les couleurs et les polices : une seule palette, dans le `@theme` de `src/tailwind.css` ; en CSS, `var(--color-ink)`, `var(--font-mono)`.
- Deux classes qui règlent la même propriété ne vont pas sur le même élément : on choisit par une condition (`on ? "border-brand" : "border-line"`).
- Une classe CSS ne porte jamais le nom d'une classe Tailwind (`fixed`, `hidden`, `block`…) : Tailwind la prendrait pour la sienne.
- Les écrans étroits : `narrow:` (900 px) et `phone:` (600 px) ; pour la barre d'outils de l'application, toujours sur une ligne, `bare:` (le logo sans le nom : 600 px, 1 280 px au doigt), `compact:` (un seul menu, trois traits : 1 100 px, 1 220 px au doigt) et `crowded:` (les réglages de l'écoute sous ⋯ : 800 px, 900 px au doigt). Au doigt (`pointer: coarse`) : `touch:`, pour des cibles de 44 px.
- L'impression en noir et blanc doit rester lisible.

## Les composants

- Un composant exposé par fichier ; ce qui ne sert qu'à lui (sous-composants, constantes de classes) reste dans son fichier, sans être exporté.
- Ce que plusieurs écrans partagent est un composant, qui porte son style, jamais une constante de classes partagée. Un composant reçoit au plus une `class` pour sa place (ses marges, sa position), que décide ce qui l'entoure.
- Plutôt que d'exposer un sous-composant, le composant reçoit ses données (`<Choices :options="…" />`).
- La barre des menus de l'application : `MenuBar` (`app/ui/menu/`), un menu ouvert passe à l'autre au survol et aux flèches ; quand la place manque, un seul « Menu », où un titre choisi montre ses actions à la place des titres (« ‹ Menu » y revient).
- Les composants s'écrivent en `<script setup lang="ts">` ; l'état partagé dans un store Pinia, les utilitaires du navigateur pris dans VueUse.
- Un menu, une fenêtre, un petit panneau, un choix qui s'ouvre : sur shadcn-vue (Reka UI : `DropdownMenu`, `Dialog`, `Popover`…), pour le clavier, le focus, Échap, le clic ailleurs et la place dans l'écran. Un composant de shadcn-vue s'ajoute par sa ligne de commande (`pnpm dlx shadcn-vue@latest add <composant>`) dans `app/ui/` et s'utilise tel quel : pas de classes pour imiter une autre allure (ses couleurs viennent de ses jetons, dans `src/tailwind.css`) ; une classe pour sa place ou ce qui est fonctionnel (une cible de 44 px au doigt, un état lisible). Son bouton est le nôtre (`as-child`).
- Un bouton est le `Button` de shadcn-vue (`app/ui/button/`), avec son allure (`variant` : `outline` d'ordinaire, `default` pour l'action qui valide, `ghost` sans cadre), sa taille (`size`), et pour un bouton à bascule, allumé ou non (`pressed`) ; des boutons collés, un `ButtonGroup` (`app/ui/button-group/`). Un `<button>` à la main seulement pour ce qui n'a pas l'air d'un bouton (une touche du clavier, un morceau de la bibliothèque, un onglet).
- L'écriture Prisma dans le texte du site : le composant `Prisma`.
- Les fichiers sont rangés par domaine : dans `src/app/`, `editor/`, `score/`, `playback/`, `files/`, `library/`, `options/`, `retouch/`, `reference/`, et `ui/` pour les éléments d'interface partagés (`dialog/`, `popover/`, `keyboard/`, `button/`, `menu/`) ; dans `src/site/`, `pages/`, `layout/`, `examples/`. Une famille de composants a son répertoire.
- `core/` ne dépend ni de Vue ni du navigateur.
- `App.vue` assemble, il ne fait pas : la logique d'un domaine va dans un composable de ce domaine (`files/useDocument`, `retouch/useRetouch`…), un morceau d'écran dans un composant.

## Vérifier avant de dire que c'est fait

- `pnpm typecheck`, `pnpm lint`, `pnpm test` et `pnpm build` passent.
- Les tests de comportement (`pnpm e2e`) et le banc de captures (`pnpm visual`) passent. Un changement voulu de l'apparence se vérifie sur les écarts, puis met à jour les références (`--update-snapshots`, pour les seules scènes concernées) ; jamais pour faire taire un écart qu'on ne comprend pas.
- Un écran, un panneau ou un état nouveau a sa scène dans le banc (`tests/visual/visual.pw.ts`) ; un comportement nouveau son test dans `tests/e2e/`, par rôle et par nom ; une logique nouvelle ses tests, à côté d'elle (le `__tests__` de son dossier).
- Un chantier fini passe dans « Fait » de la ROADMAP ; le README suit l'architecture.
