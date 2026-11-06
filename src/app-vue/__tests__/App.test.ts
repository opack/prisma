// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { CLAIR } from "../../site/examples/pieces.ts";
import App from "../App.vue";

describe("l'application Vue", () => {
  beforeEach(() => localStorage.clear());

  it("grave le morceau en cours", () => {
    localStorage.setItem("prisma:source", CLAIR);
    const app = mount(App);
    expect(app.findAll("svg.page")).toHaveLength(1);
    expect(app.text()).toContain("Au clair de la lune");
  });

  it("dit pourquoi un morceau ne se lit pas", () => {
    localStorage.setItem("prisma:source", "0 |1 |\n");
    const app = mount(App);
    expect(app.find("svg").exists()).toBe(false);
    expect(app.text()).toMatch(/^ligne \d+, col\. \d+ : /);
  });
});
