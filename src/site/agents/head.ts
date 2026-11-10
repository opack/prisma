/**
 * Ce que l'en-tête d'une page publiée dit aux moteurs de recherche, aux réseaux et aux agents :
 * son adresse canonique, sa version Markdown, son aperçu quand on la partage (Open Graph), et pour
 * l'accueil, ce qu'est Prisma en données structurées (schema.org, JSON-LD). Ajouté au build.
 */
import { ORIGIN, markdownPath, pageUrl } from "./site.ts";
import type { PublishedPage } from "./site.ts";

/** Le titre et la description d'une page, ceux de son `<title>` et de sa `<meta name="description">`. */
export type PageSummary = { title: string; description: string };

/** L'image de l'aperçu : le logo, carré. */
const IMAGE = `${ORIGIN}/icons/icon-512.png`;

const escapeAttribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Ce que l'accueil dit de Prisma : le site, et l'application, gratuite, dans le navigateur. */
function structuredData({ description }: PageSummary) {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Prisma", url: `${ORIGIN}/`, description, inLanguage: "fr" },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Prisma",
      url: `${ORIGIN}/app/`,
      description: "Lire, écrire et jouer la musique en Prisma, une notation chromatique.",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: "fr",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  ];
}

/** Les balises à ajouter à l'en-tête de la page. */
export function headTags(page: PublishedPage, summary: PageSummary) {
  const url = pageUrl(page);
  const meta = (property: string, content: string) => `<meta property="${property}" content="${escapeAttribute(content)}" />`;
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" type="text/markdown" href="${markdownPath(page)}" />`,
    meta("og:type", "website"),
    meta("og:site_name", "Prisma"),
    meta("og:locale", "fr_FR"),
    meta("og:url", url),
    meta("og:title", summary.title),
    meta("og:description", summary.description),
    meta("og:image", IMAGE),
    `<meta name="twitter:card" content="summary" />`,
  ];
  if (page === "index")
    // `<` échappé : le JSON ne peut pas fermer la balise script
    tags.push(`<script type="application/ld+json">${JSON.stringify(structuredData(summary)).replaceAll("<", "\\u003c")}</script>`);
  return tags.join("\n    ");
}
