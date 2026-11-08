<script setup lang="ts">
/**
 * Apprendre pas à pas : le format en huit étapes, chacune une idée, son texte à copier et sa
 * gravure. On tape (ou on colle) chaque exemple dans l'application à côté, pour le voir et
 * l'entendre. La référence dit tout le reste.
 */
import { slug } from "../../app/reference/slug.ts";
import { CLAIR } from "../examples/pieces.ts";
import { referenceLink } from "./referenceLinks.ts";
import Actions from "../layout/Actions.vue";
import ButtonLink from "../layout/ButtonLink.vue";
import Lead from "../layout/Lead.vue";
import OnThisPage from "../layout/OnThisPage.vue";
import Page from "../layout/Page.vue";
import Prisma from "../layout/Prisma.vue";
import Section from "../layout/Section.vue";
import SiteFooter from "../layout/SiteFooter.vue";
import SiteHeader from "../layout/SiteHeader.vue";
import { APP } from "../layout/pages.ts";
import LearnStep from "./LearnStep.vue";
import type { Step } from "./LearnStep.vue";

/** Une case du tableau des notes. */
const CELL = "px-[5px] py-[3px] border border-line text-center align-top whitespace-nowrap";

/** Les douze notes de l'octave et leur nombre. */
const NAMES = ["do", "do♯ ré♭", "ré", "ré♯ mi♭", "mi", "fa", "fa♯ sol♭", "sol", "sol♯ la♭", "la", "la♯ si♭", "si"].map((name) =>
  name.split(" "),
);

/** Les étapes, leur texte en dessous dans le gabarit. */
const STEPS: Step[] = [
  {
    title: "Une note, un nombre",
    text: `m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |2  |3  |4  ||5  |6  |7  |8  ||9  |10 |11 |12 ||
`,
    label: "Les douze notes de l'octave, de 1 à 12",
  },
  {
    title: "La règle de comptage",
    text: `m1 |1  |2  |3  |4  ||
0  |1  |3  |5  |6  ||
`,
    label: "Do, ré, mi, fa, un par temps",
  },
  {
    title: "La durée : tenir une note, ou se taire",
    text: `m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |-  |5  |   ||8  |-  |-  |-  ||
`,
    label: "Un do de deux temps, un mi, un silence, un sol de quatre temps",
  },
  {
    title: "Changer d'octave",
    text: `m1 |1  |2  |3  |4  ||
+1 |   |   |   |1  ||
0  |   |5  |8  |   ||
-1 |1  |   |   |   ||
`,
    label: "Un do grave, mi, sol, puis le do aigu",
  },
  {
    title: "Aller plus vite",
    text: `m1 |1  *  |2  *  |3  *  *  |4  ||
0  |1  3  |5  6  |8  6  5  |1  ||
`,
    label: "Deux temps de deux notes, un temps de trois notes, une note d'un temps",
  },
  {
    title: "Plusieurs notes ensemble",
    text: `m1 |1  |2  |3  |4  ||
0  |8  |-  |10 |-  ||
   |5  |-  |6  |-  ||
   |1  |-  |1  |-  ||
`,
    label: "Deux accords de deux temps : do mi sol, puis do fa la",
  },
  {
    title: "Deux portées",
    text: CLAIR.replace(/^---[\s\S]*?---\n+/, ""),
    label: "Au clair de la lune, sur deux portées",
  },
  {
    title: "Des parties, et l'ordre de jeu",
    text: `---
order: A A B A
---

@  [A]
m1 |1  |2  |3  |4  ||
0  |1  |3  |5  |-  ||

@  [B]
m2 |1  |2  |3  |4  ||
0  |8  |5  |1  |-  ||
`,
    label: "Deux parties, A et B, jouées A A B A",
  },
];

const PARTS = [
  ...STEPS.map((step, index) => ({ id: slug(step.title), label: `${index + 1}. ${step.title}` })),
  { id: "et-ensuite", label: "Et ensuite" },
];
</script>

<template>
  <SiteHeader current="apprendre" />
  <Page>
    <Section>
      <h1>Apprendre pas à pas</h1>
      <Lead>
        Huit étapes, une idée chacune. Ouvrez l'application à côté : copiez chaque exemple, collez-le dans l'éditeur, mettez en page
        (Ctrl+Entrée) et écoutez. Puis changez un nombre, et voyez ce qui change.
      </Lead>
      <Actions>
        <ButtonLink primary :href="APP">Ouvrir l'application</ButtonLink>
      </Actions>
      <OnThisPage :parts="PARTS" />
    </Section>

    <LearnStep :number="1" :step="STEPS[0]">
      <p>
        L'octave compte douze notes, de demi-ton en demi-ton, du <i>do</i> au <i>si</i>. Chacune porte un nombre, de <Prisma>1</Prisma> à
        <Prisma>12</Prisma>, et c'est tout ce qu'il faut pour la nommer.
      </p>
      <table class="block max-w-full overflow-x-auto mt-1 mb-4 text-[0.88rem]" aria-label="Le nombre de chaque note">
        <tbody>
          <tr>
            <td v-for="(_, index) in NAMES" :key="index" :class="[CELL, 'font-bold']">
              <Prisma>{{ index + 1 }}</Prisma>
            </td>
          </tr>
          <tr>
            <td v-for="spellings in NAMES" :key="spellings[0]" :class="CELL">
              <span v-for="(spelling, index) in spellings" :key="spelling"
                ><br v-if="index > 0" /><i>{{ spelling }}</i></span
              >
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Pour dire dans quelle octave jouer, chaque octave a son <b>couloir</b> : une bande de la partition, avec son numéro à gauche et
        toujours la même couleur. Le couloir <Prisma>0</Prisma> est celui de l'octave qui contient le <i>la</i> du diapason (c'est aussi
        l'octave du <i>do</i> central) ; <Prisma>+1</Prisma> est au-dessus, <Prisma>-1</Prisma> au-dessous. Le nombre dit la note, le
        couloir dit l'octave.
      </p>
      <p>Ici, les douze notes à la suite, dans le couloir <Prisma>0</Prisma>.</p>
    </LearnStep>

    <LearnStep :number="2" :step="STEPS[1]">
      <p>
        Tout en haut, la règle de comptage donne le temps : <Prisma>m1</Prisma>, le numéro de la mesure, puis ses temps,
        <Prisma>1 2 3 4</Prisma>, chacun dans sa case. Les cases sont séparées par <Prisma>|</Prisma>, et <Prisma>||</Prisma> ferme la
        mesure. Elle se lit de gauche à droite, comme on compte en jouant.
      </p>
      <p>
        Dessous, une ligne de notes, avec à gauche le numéro de son couloir, <Prisma>0</Prisma>. Puis une note par case, jouée sur son
        temps. Ici <i>do</i>, <i>ré</i>, <i>mi</i>, <i>fa</i> : <Prisma>1</Prisma>, <Prisma>3</Prisma>, <Prisma>5</Prisma>,
        <Prisma>6</Prisma>.
      </p>
    </LearnStep>

    <LearnStep :number="3" :step="STEPS[2]">
      <p>
        Une note se joue sur le temps de sa case, et dure tant qu'un trait <Prisma>-</Prisma> la prolonge : quand le trait s'arrête, elle
        s'arrête. Une case vide est un silence.
      </p>
      <p>
        Il n'y a donc pas de durée à calculer. Comptez les temps comme le fait tout musicien, « 1, 2, 3, 4 », au fil de la règle : la note
        commence sur son temps et tient jusqu'au bout de son trait.
      </p>
      <p>Ici, un <i>do</i> de deux temps, un <i>mi</i> d'un temps, un silence, puis un <i>sol</i> qui tient toute la mesure.</p>
    </LearnStep>

    <LearnStep :number="4" :step="STEPS[3]">
      <p>
        Une note plus aiguë ou plus grave va dans le couloir de son octave : une ligne <Prisma>+1</Prisma> au-dessus de <Prisma>0</Prisma>,
        une ligne <Prisma>-1</Prisma> au-dessous. Les couloirs se rangent de l'aigu, en haut, au grave, en bas, comme sur la partition.
      </p>
      <p>Le nombre ne change pas d'une octave à l'autre : le <Prisma>1</Prisma> est toujours un <i>do</i>.</p>
    </LearnStep>

    <LearnStep :number="5" :step="STEPS[4]">
      <p>
        Pour jouer deux notes dans un temps, coupez-le en deux cases : <Prisma>{{ "1  *" }}</Prisma> sur la règle. Pour trois notes, en
        trois : <Prisma>{{ "1  *  *" }}</Prisma
        >. Chaque case reçoit sa note, toujours alignée sous sa marque.
      </p>
      <p>Ici, deux temps coupés en deux, un temps coupé en trois, puis un temps entier.</p>
    </LearnStep>

    <LearnStep :number="6" :step="STEPS[5]">
      <p>
        Une ligne ne porte qu'une note à la fois. Pour un accord, écrivez une ligne par note, l'une sous l'autre. Les lignes suivantes d'une
        même octave n'ont pas de numéro : elles appartiennent à celle du dessus.
      </p>
      <p>Ici, <i>do mi sol</i> (<Prisma>1 5 8</Prisma>), puis <i>do fa la</i> (<Prisma>1 6 10</Prisma>), chacun tenu deux temps.</p>
    </LearnStep>

    <LearnStep :number="7" :step="STEPS[6]">
      <p>
        Trois tirets <Prisma>---</Prisma> séparent deux portées : au piano, la main droite au-dessus, la main gauche au-dessous ; dans une
        chanson, la voix et l'accompagnement. Chaque portée a ses propres lignes d'octave, sous la même règle.
      </p>
      <p>Voici <i>Au clair de la lune</i>. Dans l'application, coupez le son de la portée que vous jouez : elle joue l'autre avec vous.</p>
    </LearnStep>

    <LearnStep :number="8" :step="STEPS[7]">
      <p>
        Un morceau qui revient sur ses pas se découpe en parties. <Prisma>[A]</Prisma>, sur une ligne <Prisma>@</Prisma> au-dessus de la
        règle, marque le début de la partie A. En tête du texte, entre deux lignes <Prisma>---</Prisma>, <Prisma>order:</Prisma> donne
        l'ordre dans lequel les jouer.
      </p>
      <p>
        Chaque partie n'est écrite qu'une fois. On joue les lignes dans l'ordre indiqué, et c'est tout : ni reprise ni renvoi à chercher.
      </p>
    </LearnStep>

    <Section id="et-ensuite">
      <h2>Et ensuite</h2>
      <p>
        Vous savez lire et écrire un morceau. Le reste s'ajoute à mesure que vous en avez besoin :
        <a :href="referenceLink('ornaments')">les doigtés</a>, <a :href="referenceLink('expression')">les nuances et les liaisons</a>,
        <a :href="referenceLink('expression')">la pédale</a>, <a :href="referenceLink('lyrics')">les paroles</a>,
        <a :href="referenceLink('chords')">les accords d'accompagnement</a>,
        <a :href="referenceLink('ornaments')">les petites notes et les trilles</a>. Tout est dans <a href="reference.html">la référence</a>,
        avec un exemple pour chaque signe.
      </p>
      <p>Et pour un morceau que vous aimez, cherchez d'abord son fichier MusicXML : l'application l'écrit en Prisma pour vous.</p>
    </Section>
  </Page>
  <SiteFooter current="apprendre" />
</template>
