/**
 * Apprendre pas à pas : le format en huit étapes, chacune une idée, son texte à copier et sa
 * gravure. On tape (ou on colle) chaque exemple dans l'application à côté, pour le voir et
 * l'entendre. La référence dit tout le reste.
 */
import type { ReactNode } from "react";
import { Engraving, Source } from "./Example.tsx";
import { APP, Footer, Header } from "./Frame.tsx";
import { CLAIR } from "./pieces.ts";
import { referenceLink } from "./referenceLinks.ts";

type Step = { title: string; body: ReactNode; text: string; label: string };

/** Les douze notes de l'octave et leur nombre. */
const NAMES = ["do", "do♯ ré♭", "ré", "ré♯ mi♭", "mi", "fa", "fa♯ sol♭", "sol", "sol♯ la♭", "la", "la♯ si♭", "si"].map((n) => n.split(" "));

const STEPS: Step[] = [
  {
    title: "Une note, un nombre",
    body: (
      <>
        <p>
          L'octave compte douze notes, de demi-ton en demi-ton, du <i>do</i> au <i>si</i>. Chacune porte un nombre, de <code>1</code> à <code>12</code>, et c'est tout ce qu'il faut pour la nommer.
        </p>
        <table className="numbers" aria-label="Le nombre de chaque note">
          <tbody>
            <tr>
              {NAMES.map((_, i) => (
                <td key={i}>
                  <code>{i + 1}</code>
                </td>
              ))}
            </tr>
            <tr>
              {NAMES.map((n) => (
                <td key={n[0]}>
                  {n.map((x, i) => (
                    <span key={x}>
                      {i > 0 && <br />}
                      <i>{x}</i>
                    </span>
                  ))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p>
          Pour dire dans quelle octave jouer, chaque octave a son <b>couloir</b> : une bande de la partition, avec son numéro à gauche et toujours la même couleur. Le couloir{" "}
          <code>0</code> est celui de l'octave qui contient le <i>la</i> du diapason (c'est aussi l'octave du <i>do</i> central) ; <code>+1</code> est au-dessus,{" "}
          <code>-1</code> au-dessous. Le nombre dit la note, le couloir dit l'octave.
        </p>
        <p>Ici, les douze notes à la suite, dans le couloir <code>0</code>.
        </p>
      </>
    ),
    text: `m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |2  |3  |4  ||5  |6  |7  |8  ||9  |10 |11 |12 ||
`,
    label: "Les douze notes de l'octave, de 1 à 12",
  },
  {
    title: "La règle de comptage",
    body: (
      <>
        <p>
          Tout en haut, la règle de comptage donne le temps : <code>m1</code>, le numéro de la mesure, puis ses temps, <code>1 2 3 4</code>, chacun dans sa case. Les cases sont
          séparées par <code>|</code>, et <code>||</code> ferme la mesure. Elle se lit de gauche à droite, comme on compte en jouant.
        </p>
        <p>
          Dessous, une ligne de notes, avec à gauche le numéro de son couloir, <code>0</code>. Puis une note par case, jouée sur son temps. Ici <i>do</i>, <i>ré</i>, <i>mi</i>, <i>fa</i> : <code>1</code>, <code>3</code>, <code>5</code>, <code>6</code>.
        </p>
      </>
    ),
    text: `m1 |1  |2  |3  |4  ||
0  |1  |3  |5  |6  ||
`,
    label: "Do, ré, mi, fa, un par temps",
  },
  {
    title: "La durée : tenir une note, ou se taire",
    body: (
      <>
        <p>
          Une note se joue sur le temps de sa case, et dure tant qu'un trait <code>-</code> la prolonge : quand le trait s'arrête, elle s'arrête. Une case vide est un
          silence.
        </p>
        <p>
          Il n'y a donc pas de durée à calculer. Comptez les temps comme le fait tout musicien, « 1, 2, 3, 4 », au fil de la règle : la note commence sur son temps et tient
          jusqu'au bout de son trait.
        </p>
        <p>Ici, un <i>do</i> de deux temps, un <i>mi</i> d'un temps, un silence, puis un <i>sol</i> qui tient toute la mesure.</p>
      </>
    ),
    text: `m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||
0  |1  |-  |5  |   ||8  |-  |-  |-  ||
`,
    label: "Un do de deux temps, un mi, un silence, un sol de quatre temps",
  },
  {
    title: "Changer d'octave",
    body: (
      <>
        <p>
          Une note plus aiguë ou plus grave va dans le couloir de son octave : une ligne <code>+1</code> au-dessus de <code>0</code>, une ligne <code>-1</code> au-dessous. Les
          couloirs se rangent de l'aigu, en haut, au grave, en bas, comme sur la partition.
        </p>
        <p>Le nombre ne change pas d'une octave à l'autre : le <code>1</code> est toujours un <i>do</i>.</p>
      </>
    ),
    text: `m1 |1  |2  |3  |4  ||
+1 |   |   |   |1  ||
0  |   |5  |8  |   ||
-1 |1  |   |   |   ||
`,
    label: "Un do grave, mi, sol, puis le do aigu",
  },
  {
    title: "Aller plus vite",
    body: (
      <>
        <p>
          Pour jouer deux notes dans un temps, coupez-le en deux cases : <code>1  *</code> sur la règle. Pour trois notes, en trois : <code>1  *  *</code>. Chaque case reçoit sa
          note, toujours alignée sous sa marque.
        </p>
        <p>Ici, deux temps coupés en deux, un temps coupé en trois, puis un temps entier.</p>
      </>
    ),
    text: `m1 |1  *  |2  *  |3  *  *  |4  ||
0  |1  3  |5  6  |8  6  5  |1  ||
`,
    label: "Deux temps de deux notes, un temps de trois notes, une note d'un temps",
  },
  {
    title: "Plusieurs notes ensemble",
    body: (
      <>
        <p>
          Une ligne ne porte qu'une note à la fois. Pour un accord, écrivez une ligne par note, l'une sous l'autre. Les lignes suivantes d'une même octave n'ont pas de numéro : elles
          appartiennent à celle du dessus.
        </p>
        <p>Ici, <i>do mi sol</i> (<code>1 5 8</code>), puis <i>do fa la</i> (<code>1 6 10</code>), chacun tenu deux temps.</p>
      </>
    ),
    text: `m1 |1  |2  |3  |4  ||
0  |8  |-  |10 |-  ||
   |5  |-  |6  |-  ||
   |1  |-  |1  |-  ||
`,
    label: "Deux accords de deux temps : do mi sol, puis do fa la",
  },
  {
    title: "Deux portées",
    body: (
      <>
        <p>
          Trois tirets <code>---</code> séparent deux portées : au piano, la main droite au-dessus, la main gauche au-dessous ; dans une chanson, la voix et l'accompagnement. Chaque
          portée a ses propres lignes d'octave, sous la même règle.
        </p>
        <p>
          Voici <i>Au clair de la lune</i>. Dans l'application, coupez le son de la portée que vous jouez : elle joue l'autre avec vous.
        </p>
      </>
    ),
    text: CLAIR.replace(/^---[\s\S]*?---\n+/, ""),
    label: "Au clair de la lune, sur deux portées",
  },
  {
    title: "Des parties, et l'ordre de jeu",
    body: (
      <>
        <p>
          Un morceau qui revient sur ses pas se découpe en parties. <code>[A]</code>, sur une ligne <code>@</code> au-dessus de la règle, marque le début de la partie A. En tête du
          texte, entre deux lignes <code>---</code>, <code>order:</code> donne l'ordre dans lequel les jouer.
        </p>
        <p>Chaque partie n'est écrite qu'une fois. On joue les lignes dans l'ordre indiqué, et c'est tout : ni reprise ni renvoi à chercher.</p>
      </>
    ),
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

export function Learn() {
  return (
    <>
      <Header />
      <main className="learn">
        <section className="intro">
          <h1>Apprendre pas à pas</h1>
          <p className="lead">
            Huit étapes, une idée chacune. Ouvrez l'application à côté : copiez chaque exemple, collez-le dans l'éditeur, mettez en page (Ctrl+Entrée) et écoutez. Puis changez un
            nombre, et voyez ce qui change.
          </p>
          <p className="actions">
            <a className="button primary" href={APP}>
              Ouvrir l'application
            </a>
          </p>
        </section>

        {STEPS.map((s, i) => (
          <section key={s.title} className="idea step">
            <div className="idea-text">
              <h2>
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </div>
            <div className="step-example">
              <Source text={s.text} />
              <Engraving text={s.text} label={s.label} />
            </div>
          </section>
        ))}

        <section>
          <h2>Et ensuite</h2>
          <p>
            Vous savez lire et écrire un morceau. Le reste s'ajoute à mesure que vous en avez besoin : <a href={referenceLink("ornaments")}>les doigtés</a>,{" "}
            <a href={referenceLink("expression")}>les nuances et les liaisons</a>, <a href={referenceLink("expression")}>la pédale</a>, <a href={referenceLink("lyrics")}>les paroles</a>,{" "}
            <a href={referenceLink("chords")}>les accords d'accompagnement</a>, <a href={referenceLink("ornaments")}>les petites notes et les trilles</a>. Tout est dans{" "}
            <a href="reference.html">la référence</a>, avec un exemple pour chaque signe.
          </p>
          <p>
            Et pour un morceau que vous aimez, cherchez d'abord son fichier MusicXML : l'application l'écrit en Prisma pour vous.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
