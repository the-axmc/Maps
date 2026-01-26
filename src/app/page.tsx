import MapBuilder from "@/components/MapBuilder";
import { readdirSync } from "fs";
import path from "path";

const loadCountries = () => {
  const countriesDir = path.join(process.cwd(), "public", "countries");
  try {
    return readdirSync(countriesDir)
      .filter((file) => file.toLowerCase().endsWith(".svg"))
      .map((file) => {
        const label = file.replace(/\.svg$/i, "");
        return { id: label, label, file };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
};

export default function Home() {
  const availableCountries = loadCountries();
  return (
    <>
      <MapBuilder availableCountries={availableCountries} />
      <p
        className="site-footer"
        style={{ color: "#000", margin: "8px 0", textAlign: "center" }}
      >
        Built with <span aria-hidden="true">♥</span> by{" "}
        <a
          href="https://www.github.com/the-axmc"
          style={{ color: "#000" }}
        >
          andlopvic
        </a>
      </p>
    </>
  );
}
