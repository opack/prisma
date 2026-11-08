/** L'application (/app/) : ses composants Vue, ses stores Pinia (les réglages), son style. */
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "../tailwind.css";

createApp(App).use(createPinia()).mount("#app");
