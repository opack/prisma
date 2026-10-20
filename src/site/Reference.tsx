/** La référence, telle que dans l'application : la référence complète du format, ses exemples gravés. */
import { ReferenceView } from "../app/ReferenceView.tsx";
import { DEFAULT_OPTIONS } from "../app/options.ts";
import { Example } from "./Example.tsx";
import { Footer, Header } from "./Frame.tsx";

export function Reference() {
  return (
    <>
      <Header />
      <main className="reference-page">
        <ReferenceView options={DEFAULT_OPTIONS} example={(text) => <Example text={text} scale={1.4} label="Un exemple de la référence" />} />
      </main>
      <Footer />
    </>
  );
}
