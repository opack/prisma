// @vitest-environment happy-dom
/**
 * La gravure en Vue dessine exactement la page de React : le même SVG, élément par élément et
 * attribut par attribut, sur un corpus (les exemples du site et de la référence, la Gymnopédie) et
 * à plusieurs réglages. Ce test vit le temps de la migration : il part avec l'application React.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import type { Component } from "vue";
import { renderToString } from "vue/server-renderer";
import { DEFAULT_OPTIONS } from "../../../app/options/options.ts";
import type { RenderOptions } from "../../../app/options/options.ts";
import { Excerpt as ReactExcerpt, PageView as ReactPageView } from "../../../app/score/PageView.tsx";
import { engraveOptions, engravePages, scoreOf } from "../../../app/score/render.ts";
import { importMusicXml, writePrisma } from "../../../core/index.ts";
import * as sitePieces from "../../../site/examples/pieces.ts";
import Excerpt from "../Excerpt.vue";
import PageView from "../PageView.vue";

/** Les exemples ```prisma de la référence (dans une liste, ils sont indentés). */
function referenceExamples(): string[] {
  const markdown = readFileSync("REFERENCE.md", "utf8");
  return [...markdown.matchAll(/^( *)```prisma\n([\s\S]*?)^\1```/gm)].map(([, indent, body]) =>
    body
      .split("\n")
      .map((line) => line.slice(indent.length))
      .join("\n"),
  );
}

const gymnopedie = writePrisma(importMusicXml(readFileSync("tests/fixtures/gymnopedie1.musicxml", "utf8")));
const pieces: [string, string][] = Object.entries(sitePieces).filter(([, value]) => typeof value === "string");

/** Des réglages qui changent le dessin, un par un. */
const VARIANTS: Record<string, Partial<RenderOptions>> = {
  "par défaut": {},
  "octaves en flèches, au centre": { octaveStyle: "arrow", octavePosition: "center" },
  "octaves en signes, sans couleur": { octaveStyle: "sign", octaveColors: "none" },
  "notes centrées, teintes feutrées": { notePosition: "center", octaveColors: "muted" },
  "une ligne par note, sections à la suite": { notePosition: "pitch", sections: "inline" },
  "accords en grilles, récapitulées": { chords: "grid", chordChart: true },
  "accords en notes, noms anglais": { chords: "notes", chordNames: "english", noteNames: "english" },
  "accords nommés, sans noms de notes": { chords: "name", noteNames: "none" },
  "compact, sans rappels ni doigtés": { density: "compact", holdReminders: false, fingerings: false },
  "noms à chaque système, règle détaillée": { namesEverySystem: true, rulerDetail: "subdivision" },
  "pédales simile atténuées": { simile: "faded" },
  "simile en mention seule": { simile: "text" },
};

/**
 * Le SVG sous une forme comparable, un élément par ligne : les attributs triés, le style sans
 * espaces, sans les commentaires que posent React (entre deux textes) et Vue (fragments, v-if).
 */
function canonical(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  const lines: string[] = [];
  const walk = (node: Node, depth: number) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const attributes = [...element.attributes]
        .map(({ name, value }) => `${name}="${name === "style" ? value.replace(/\s|;$/g, "") : value}"`)
        .sort()
        .join(" ");
      lines.push(`${"  ".repeat(depth)}<${element.tagName.toLowerCase()} ${attributes}>`);
      let text = "";
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (text) lines.push(`${"  ".repeat(depth + 1)}« ${text} »`);
          text = "";
          walk(child, depth + 1);
        }
      }
      if (text) lines.push(`${"  ".repeat(depth + 1)}« ${text} »`);
    }
  };
  container.childNodes.forEach((child) => walk(child, 0));
  return lines.join("\n");
}

const vueMarkup = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp(component, props));

function engraved(text: string, variant: Partial<RenderOptions>) {
  const options = { ...DEFAULT_OPTIONS, ...variant };
  const score = scoreOf(text, "prisma", "");
  return { options, meta: score.meta, pages: engravePages(score, engraveOptions(options)) };
}

describe("la page gravée en Vue est celle de React", () => {
  const corpus: [string, string][] = [["Gymnopédie", gymnopedie], ...pieces];
  for (const [variantName, variant] of Object.entries(VARIANTS))
    it.each(corpus)(`${variantName} : %s`, async (_, text) => {
      const { options, meta, pages } = engraved(text, variant);
      for (const page of pages) {
        const props = { page, total: pages.length, meta, options };
        const react = renderToStaticMarkup(createElement(ReactPageView, { ...props, still: true }));
        expect(canonical(await vueMarkup(PageView, props))).toBe(canonical(react));
      }
    });
});

describe("l'extrait gravé en Vue est celui de React", () => {
  it.each(referenceExamples().map((text, index) => [index + 1, text]))("exemple %i de la référence", async (_, text) => {
    const { options, pages } = engraved(text as string, {});
    const props = { pages, options, scale: 1.4 };
    expect(canonical(await vueMarkup(Excerpt, props))).toBe(canonical(renderToStaticMarkup(createElement(ReactExcerpt, props))));
  });
});
