// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import App from "../App.vue";

describe("l'application Vue", () => {
  it("salue quand on appuie sur le bouton", async () => {
    const app = mount(App);
    const button = app.get("button");
    expect(button.text()).toBe("Saluer");
    await button.trigger("click");
    expect(button.text()).toBe("Bonjour !");
  });
});
