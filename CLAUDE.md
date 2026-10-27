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
- Restent en CSS, seulement : la mise en page de la vue principale (`app/styles.css`), la gravure, le thème de CodeMirror, l'impression, la référence (du Markdown rendu) et le tableau de la comparaison.
- Deux classes qui règlent la même propriété ne vont pas sur le même élément : on choisit par une condition (`on ? "border-accent" : "border-line"`).
- Une classe CSS ne porte jamais le nom d'une classe Tailwind (`fixed`, `hidden`, `block`…) : Tailwind la prendrait pour la sienne.
- Les écrans étroits : `narrow:` (900 px) et `phone:` (600 px) ; pour la barre d'outils de l'application, `compact:` (1000 px, un seul menu) et `stacked:` (720 px, l'écoute sur sa ligne).
- L'impression en noir et blanc doit rester lisible.

## Les composants

- Un composant exposé par fichier ; ce qui ne sert qu'à lui (sous-composants, constantes de classes) reste dans son fichier, sans être exporté.
- Ce que plusieurs écrans partagent est un composant, qui porte son style, jamais une constante de classes partagée. Un composant reçoit au plus un `className` pour sa place (ses marges, sa position), que décide ce qui l'entoure.
- Plutôt que d'exposer un sous-composant, le composant reçoit ses données (`<Choices options={…} />`).
- Les fichiers sont rangés par domaine : dans `src/app/`, `editor/`, `score/`, `playback/`, `files/`, `library/`, `options/`, `retouch/`, `reference/`, et `ui/` pour les éléments d'interface partagés (`dialog/`, `popover/`, `keyboard/`, les boutons) ; dans `src/site/`, `pages/`, `layout/`, `examples/`. Une famille de composants a son répertoire.
- `core/` ne dépend ni de React ni du navigateur.

## Vérifier avant de dire que c'est fait

- `npm run typecheck`, `npm test` et `npm run build` passent.
- Le banc de captures (`npm run visual`) passe. Un changement voulu de l'apparence se vérifie sur les écarts, puis met à jour les références (`--update-snapshots`, pour les seules scènes concernées) ; jamais pour faire taire un écart qu'on ne comprend pas.
- Un écran, un panneau ou un état nouveau a sa scène dans le banc (`tests/visual/visual.pw.ts`), et une logique nouvelle ses tests (`tests/`).
- Un chantier fini passe dans « Fait » de la ROADMAP ; le README suit l'architecture.
