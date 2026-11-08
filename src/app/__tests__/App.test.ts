// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { CLAIR } from "../../site/examples/pieces.ts";
import App from "../App.vue";

describe("l'application Vue", () => {
  beforeEach(() => localStorage.clear());

  it("ouvre le morceau en cours en lecture : sa partition, sans l'éditeur", async () => {
    localStorage.setItem("prisma:source", CLAIR);
    localStorage.setItem("prisma:editing", "false");
    const app = mount(App, { attachTo: document.body, global: { plugins: [createPinia()] } });
    await flushPromises();
    expect(app.findAll("svg.page")).toHaveLength(1);
    expect(app.find("section[aria-label='Partition']").text()).toContain("Au clair de la lune");
    expect(app.find("section:has(.cm-editor)").attributes("hidden")).toBeDefined();
    app.unmount();
  });

  it("ouvre en édition un morceau qui ne se lit pas, et dit pourquoi", async () => {
    localStorage.setItem("prisma:source", "0 |1 |\n");
    localStorage.setItem("prisma:editing", "false");
    const app = mount(App, { attachTo: document.body, global: { plugins: [createPinia()] } });
    await flushPromises();
    expect(app.find("svg.page").exists()).toBe(false);
    expect(app.find("section:has(.cm-editor)").attributes("hidden")).toBeUndefined();
    expect(app.find('[title="aller à l\'erreur"]').text()).toMatch(/^ligne \d+, col\. \d+ : /);
    app.unmount();
  });
});
