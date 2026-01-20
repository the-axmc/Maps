import MapBuilder from "@/components/MapBuilder";

export default function Home() {
  return (
    <>
      <MapBuilder />
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
