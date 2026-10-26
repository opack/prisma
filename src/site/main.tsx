import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./pages/Home.tsx";
import { Comparison } from "./pages/Comparison.tsx";
import { Guitar } from "./pages/Guitar.tsx";
import { Learn } from "./pages/Learn.tsx";
import { Reference } from "./pages/Reference.tsx";
import "../tailwind.css";
import "./site.css";

const root = document.getElementById("root")!;
const PAGES = { comparaison: Comparison, apprendre: Learn, reference: Reference, guitare: Guitar } as const;
const Page = PAGES[root.dataset.page as keyof typeof PAGES] ?? Home;
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
