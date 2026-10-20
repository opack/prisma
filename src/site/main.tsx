import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./Home.tsx";
import { Comparison } from "./Comparison.tsx";
import { Learn } from "./Learn.tsx";
import { Reference } from "./Reference.tsx";
import "./site.css";

const root = document.getElementById("root")!;
const PAGES = { comparaison: Comparison, apprendre: Learn, reference: Reference } as const;
const Page = PAGES[root.dataset.page as keyof typeof PAGES] ?? Home;
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
