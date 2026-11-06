/**
 * L'application en Vue, en construction à côté de celle de React (/app-vue/) : elle la remplacera
 * domaine par domaine, puis prendra sa place.
 */
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "../vue.css";

createApp(App).use(createPinia()).mount("#app");
