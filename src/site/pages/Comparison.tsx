/**
 * La comparaison avec la partition classique, pour qui la connaît : ce qu'elle demande d'apprendre
 * et ce que Prisma écrit à la place, puis, honnêtement, ce que Prisma perd.
 */
import type { ReactNode } from "react";
import { Example } from "../examples/Example.tsx";
import { CHORDS, CLAIR_SECTIONS, TWO_CHORDS } from "../examples/pieces.ts";
import { StaffChords } from "../examples/StaffChords.tsx";
import { Engraving } from "../examples/Example.tsx";
import { APP, Footer, Header } from "../layout/Frame.tsx";
import { ButtonLink } from "../layout/ButtonLink.tsx";
import { Caption } from "../layout/Caption.tsx";
import { Idea } from "../layout/Idea.tsx";
import { IdeaText } from "../layout/IdeaText.tsx";
import { Lead } from "../layout/Lead.tsx";
import { OnThisPage } from "../layout/OnThisPage.tsx";
import { Page } from "../layout/Page.tsx";
import { Section } from "../layout/Section.tsx";
import { Prisma } from "../layout/Prisma.tsx";

/** Un fa dièse qui revient, puis un fa naturel : la partition classique les écrit avec une armure et un bécarre ; Prisma, 7 et 6. */
const SHARP = `---
format: 1
---

m1 |1  |2  |3  ||1  |2  |3  ||
0  |8  |7  |8  ||6  |5  |-  ||
`;

const ROWS: { what: string; classic: ReactNode; prisma: ReactNode }[] = [
  {
    what: "Les clés",
    classic: (
      <>
        <i>Sol</i>, <i>fa</i>, <i>ut</i> : la même ligne de la portée change de note selon la clé posée au début. Le piano en demande deux, <i>sol</i> et <i>fa</i> ; l'alto lit
        en <i>ut</i>.
      </>
    ),
    prisma: "Le nombre est la note, sur toutes les lignes et toutes les portées.",
  },
  {
    what: "L'octave",
    classic: "Lignes supplémentaires au-dessus et au-dessous de la portée, signes 8va et 8vb : plus la note s'éloigne de la clé, plus elle est dure à lire.",
    prisma: "Chaque ligne porte son octave dans la marge, avec la couleur de son couloir. Une note de l'extrême aigu se lit comme une note du médium.",
  },
  {
    what: "L'armure",
    classic: "Des dièses ou des bémols en début de ligne, qui modifient certaines notes pour tout le morceau, sans les montrer là où elles sont.",
    prisma: "Aucune : chaque note est écrite telle qu'elle se joue, là où elle se joue.",
  },
  {
    what: "Les altérations",
    classic: "♯, ♭ et ♮ devant les notes, valables jusqu'à la barre de mesure, à retenir en lisant.",
    prisma: (
      <>
        Aucune : chacune des douze notes a son propre nombre. Le <Prisma>7</Prisma> est toujours la même note.
      </>
    ),
  },
  {
    what: "Les noms doubles",
    classic: (
      <>
        <i>Fa dièse</i> et <i>sol bémol</i> sont la même note sous deux noms, choisis selon la tonalité.
      </>
    ),
    prisma: "Un seul nombre par note.",
  },
  {
    what: "Les durées",
    classic: "Ronde, blanche, noire, croche, double croche, points, liaisons de durée : la forme de la note dit sa durée, et il faut additionner les valeurs pour savoir où tombe chaque note.",
    prisma: "La règle de comptage donne les temps ; une note dure de sa case jusqu'au bout de ses traits de tenue. La durée se voit à la place.",
  },
  {
    what: "Les renvois",
    classic: "Reprises, cases 1. et 2., D.C., D.S., coda, Fine : il faut repérer les signes et sauter dans la page en jouant.",
    prisma: (
      <>
        Le morceau est découpé en sections (A, B, C…), chacune écrite une seule fois. L'ordre dans lequel les jouer, par exemple <Prisma>A A B A</Prisma>, est écrit en tête de la
        partition : on le suit, sans aucun saut à repérer.
      </>
    ),
  },
];

const LOSSES: { what: string; why: ReactNode }[] = [
  {
    what: "Le dessin de la mélodie",
    why: "Sur la portée, une mélodie qui monte monte sur la page : on en voit la courbe avant de lire les notes. En Prisma, on lit des nombres, et seules les octaves s'empilent. Le réglage « Une ligne par note » rend ce dessin, sans l'égaler tout à fait.",
  },
  {
    what: "La tonalité",
    why: (
      <>
        L'armure rappelle la gamme du morceau à chaque ligne. Pour jouer, Prisma n'en a pas besoin : chaque note est écrite telle qu'elle se joue. Pour qui veut la connaître, pour
        improviser ou comprendre l'harmonie, l'en-tête peut l'écrire une fois, en tête de la partition (<Prisma>key: 8</Prisma> pour <i>sol</i> majeur), sans rien changer aux notes.
      </>
    ),
  },
  {
    what: "Le répertoire",
    why: "Presque toute la musique écrite l'est en notation classique. Mais elle circule de plus en plus en fichiers MusicXML, que MuseScore et la plupart des logiciels de partition exportent : l'application les ouvre et les écrit en Prisma, avec les doigtés, les nuances, les liaisons, la pédale, les paroles et les accords. Un morceau qui vous plaît est souvent à un import de distance.",
  },
  {
    what: "Une langue commune",
    why: (
      <>
        Un professeur, un chef de chœur, un autre musicien lisent la portée, et pas encore Prisma. En attendant, l'application affiche à la demande le nom des notes (<i>do</i>,{" "}
        <i>ré</i>, <i>mi</i>, ou <i>C</i>, <i>D</i>, <i>E</i>), et exporte le morceau en MusicXML : MuseScore l'ouvre en partition classique, pour ceux qui la lisent.
      </>
    ),
  },
  {
    what: "La compacité",
    why: "Une portée dense tient en peu de place ; Prisma écrit une ligne par note jouée ensemble, et un accord de quatre notes prend quatre lignes. Les réglages de mise en page (l'espacement compact, les sections à la suite) réduisent beaucoup l'écart : souvent une page de plus sur une partition de six, parfois aucune.",
  },
];

/** Les parties de la page, pour « Sur cette page ». */
/** Une tête de colonne du tableau : son nom, gris, au-dessus d'un trait noir. */
const HEAD = "px-4 py-3.5 text-left align-top text-[0.95rem] text-muted border-b-2 border-ink";

const PARTS = {
  kept: { id: "garde", label: "Ce que Prisma garde" },
  removed: { id: "retire", label: "Ce qu'il retire" },
  sharp: {
    id: "fa-diese",
    label: (
      <>
        Le <i>fa dièse</i>
      </>
    ),
  },
  repeats: { id: "renvois", label: "Les renvois" },
  chords: { id: "accords", label: "Les accords" },
  alike: { id: "accords-semblables", label: "Deux accords semblables" },
  lost: { id: "perd", label: "Ce qu'il perd" },
  who: { id: "pour-qui", label: "Pour qui ?" },
};

export function Comparison() {
  return (
    <>
      <Header current="comparaison" />
      <Page>
        <Section first>
          <h1>Prisma et la partition classique</h1>
          <Lead>
            La partition classique est un outil remarquable, affiné pendant des siècles. Mais une bonne part de ce qu'elle demande d'apprendre ne sert qu'à elle-même : les clés,
            l'armure, les altérations, les figures de durée. Voici ce que Prisma garde, ce qu'il retire, et ce qu'il perd.
          </Lead>
          <OnThisPage parts={Object.values(PARTS)} />
        </Section>

        <Section id={PARTS.kept.id}>
          <h2>Ce que Prisma garde</h2>
          <p>Tout ce qui sert à jouer, et que la partition classique a bien trouvé :</p>
          <ul className="m-0 pl-[1.2em] max-w-[44em] [&_li]:mb-1.5">
            <li>la lecture de gauche à droite, mesure après mesure, avec les barres de mesure ;</li>
            <li>les temps de la mesure, comptés au-dessus des notes ;</li>
            <li>une portée par main ou par voix, réunies par l'accolade ;</li>
            <li>l'aigu en haut et le grave en bas : les octaves s'empilent de l'aiguë à la grave ;</li>
            <li>les doigtés ;</li>
            <li>les indications d'interprétation : liaisons de phrasé, nuances, pédale, tempo et caractère.</li>
          </ul>
        </Section>

        <Section id={PARTS.removed.id}>
          <h2>Ce que Prisma retire</h2>
          {/* sur un téléphone, une fiche par ligne : chaque case dit sa colonne au-dessus d'elle */}
          <table className="w-full border-collapse text-[1rem] phone:block">
            <thead className="phone:hidden">
              <tr>
                <th scope="col" className={HEAD}>
                  <span className="sr-only">Ce qui s'apprend</span>
                </th>
                <th scope="col" className={HEAD}>
                  Partition classique
                </th>
                <th scope="col" className={HEAD}>
                  Prisma
                </th>
              </tr>
            </thead>
            <tbody className="phone:block">
              {ROWS.map((r) => (
                <tr key={r.what} className="phone:block phone:py-3 phone:border-b phone:border-line">
                  <th scope="row" className="w-[16%] px-4 py-3.5 text-left align-top font-bold border-b border-line phone:block phone:w-auto phone:border-0 phone:px-0 phone:py-1">
                    {r.what}
                  </th>
                  <td className="px-4 py-3.5 align-top border-b border-line phone:block phone:border-0 phone:px-0 phone:py-1 phone:before:block phone:before:text-[0.85rem] phone:before:text-muted phone:before:content-['Partition_classique']">{r.classic}</td>
                  <td className="px-4 py-3.5 align-top border-b border-line bg-accent-5 phone:block phone:border-0 phone:px-2.5 phone:py-2 phone:rounded-md phone:before:block phone:before:text-[0.85rem] phone:before:text-muted phone:before:content-['Prisma']">{r.prisma}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Idea id={PARTS.sharp.id}>
          <IdeaText>
            <h2>
              Un exemple : le <i>fa dièse</i>
            </h2>
            <p>
              En <i>sol</i> majeur, la partition classique pose un dièse sur la ligne du <i>fa</i>, à la clé, et tous les <i>fa</i> du morceau deviennent des <i>fa dièse</i>, sans que rien ne le rappelle sur la
              note. Quand la mélodie a besoin d'un <i>fa naturel</i>, il faut un bécarre devant la note, valable jusqu'à la barre de mesure.
            </p>
            <p>
              En Prisma, le <i>fa dièse</i> s'écrit <Prisma>7</Prisma>, à chaque fois, et le <i>fa naturel</i> <Prisma>6</Prisma> : rien à retenir d'une note à l'autre.
            </p>
          </IdeaText>
          <Example text={SHARP} label="Sol, fa dièse, sol, puis fa naturel, mi" />
        </Idea>

        <Idea kind="wide" id={PARTS.repeats.id}>
          <IdeaText>
            <h2>Un exemple : les renvois</h2>
            <p>
              <i>Au clair de la lune</i> se joue <Prisma>A A B A</Prisma>. La partition classique l'écrit avec une reprise autour de A, puis B, puis un <i>D.C. al Fine</i> : revenir au début
              et s'arrêter au mot <i>Fine</i>, sans refaire la reprise. Il faut repérer chaque signe et savoir où sauter.
            </p>
            <p>
              Prisma fait comme une chanson. Une chanson enchaîne ses couplets, son refrain, parfois un pont, et le refrain revient plusieurs fois : on ne le réécrit pas à chaque
              fois, on sait qu'il revient. Ici, la partie A est le couplet, la partie B le pont : chacune est écrite une fois, sur sa ligne, et l'ordre de jeu en tête de la
              partition dit comment elles s'enchaînent. On lit l'ordre, on joue les lignes : c'est tout. Pour une partition plus courte, les parties peuvent aussi se suivre sur la
              même ligne.
            </p>
          </IdeaText>
          <Example text={CLAIR_SECTIONS} scale={1.25} label="Au clair de la lune : la partie A, la partie B, et l'ordre de jeu A A B A" />
        </Idea>

        <Idea id={PARTS.chords.id}>
          <IdeaText>
            <h2>Ce que Prisma rend plus simple : les accords</h2>
            <p>
              En Prisma, un accord se lit et se construit en comptant. L'écart entre deux nombres est toujours le même, quelles que soient les notes : <Prisma>4</Prisma>, c'est une tierce
              majeure ; <Prisma>3</Prisma>, une tierce mineure ; <Prisma>7</Prisma>, une quinte.
            </p>
            <p>Partez de la note qui donne son nom à l'accord, sa fondamentale, et ajoutez :</p>
            <ul>
              <li>
                pour un accord majeur, <Prisma>+4</Prisma> et <Prisma>+7</Prisma> : <i>do</i> majeur s'écrit <Prisma>1 5 8</Prisma> ;
              </li>
              <li>
                pour un accord mineur, <Prisma>+3</Prisma> et <Prisma>+7</Prisma> : <i>do</i> mineur s'écrit <Prisma>1 4 8</Prisma> ;
              </li>
              <li>
                pour un accord de septième, <Prisma>+4</Prisma>, <Prisma>+7</Prisma> et <Prisma>+10</Prisma> : <i>do</i> 7 s'écrit <Prisma>1 5 8 11</Prisma> ;
              </li>
              <li>
                pour un accord diminué, <Prisma>+3</Prisma> et <Prisma>+6</Prisma> : <i>do</i> diminué s'écrit <Prisma>1 4 7</Prisma>.
              </li>
            </ul>
            <p>
              Pour lire un accord, on fait l'inverse : on regarde les écarts. Et pour en changer, on change un nombre : de <i>do</i> majeur à <i>do</i> mineur, le <Prisma>5</Prisma> devient <Prisma>4</Prisma>. La recette vaut
              pour toutes les fondamentales : <i>ré</i> mineur, c'est <Prisma>3 6 10</Prisma>.
            </p>
            <p>
              Le nom d'un accord se lit de même : sa fondamentale, puis sa sorte. <Prisma>1</Prisma> est <i>do</i> majeur, <Prisma>1:m</Prisma> <i>do</i> mineur, <Prisma>8:7</Prisma>{" "}
              <i>sol</i> 7. Pas de lettre à traduire en note : le nombre est déjà la note.
            </p>
          </IdeaText>
          <Example text={CHORDS} options={{ notePosition: "aligned", chords: "name" }} label="Do majeur, do mineur, do septième, do diminué : les nombres changent d'un ou deux" />
        </Idea>

        <Idea id={PARTS.alike.id}>
          <IdeaText>
            <h2>Sur la partition classique, deux accords qui se ressemblent</h2>
            <p>
              La portée classique ne montre pas les demi-tons. <i>Do mi sol</i> et <i>mi sol si</i> s'y écrivent de la même façon : trois notes sur trois lignes voisines. Le premier est pourtant
              un accord majeur, le second un accord mineur ; rien ne le montre, il faut connaître les notes pour le savoir. Avec des dièses et des bémols, c'est pire encore.
            </p>
            <p>
              En Prisma, <i>do mi sol</i> s'écrit <Prisma>1 5 8</Prisma>, des écarts de <Prisma>4</Prisma> puis <Prisma>3</Prisma> ; <i>mi sol si</i>, <Prisma>5 8 12</Prisma>, des écarts de{" "}
              <Prisma>3</Prisma> puis <Prisma>4</Prisma>. La différence se lit.
            </p>
          </IdeaText>
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <Caption className="mb-1.5">Partition classique</Caption>
              <StaffChords />
            </div>
            <div>
              <Caption className="mb-1.5">Prisma</Caption>
              <Engraving text={TWO_CHORDS} options={{ chords: "name" }} label="Do mi sol (1 5 8) puis mi sol si (5 8 12)" />
            </div>
          </div>
        </Idea>

        <Section id={PARTS.lost.id}>
          <h2>Ce que Prisma perd</h2>
          <p>Ce choix a un prix. Le voici, sans détour.</p>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-10 gap-y-6">
            {LOSSES.map((l) => (
              <div key={l.what}>
                <dt className="font-bold mb-1">{l.what}</dt>
                <dd className="m-0 text-[#303437]">{l.why}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id={PARTS.who.id}>
          <h2>Pour qui ?</h2>
          <p>
            Pour qui veut jouer les morceaux qui lui plaisent sans passer d'abord par des mois, voire des années, de solfège : un adulte qui commence ou recommence, un enfant qui
            découvre son instrument, quelqu'un que la lecture des notes a découragé.
          </p>
          <p>
            Prisma n'est pas une étape avant la partition classique : c'est une autre façon d'écrire la même musique, faite pour être lue tout de suite. Comme parler la langue d'un
            pays sans des années d'études : on en profite pleinement, dès l'arrivée.
          </p>
        </Section>

        <Section className="text-center">
          <h2>Le plus simple est d'essayer.</h2>
          <ButtonLink primary href={APP}>
            Ouvrir l'application
          </ButtonLink>
        </Section>
      </Page>
      <Footer current="comparaison" />
    </>
  );
}
