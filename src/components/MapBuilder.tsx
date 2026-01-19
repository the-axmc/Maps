"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CountryConfig = {
  fill: string;
  popupText: string;
  link: string;
};

type PopupState = {
  isVisible: boolean;
  title: string;
  body: string;
  link: string;
  x: number;
  y: number;
};

type HistoryEntry =
  | { type: "country"; countryId: string; prev: CountryConfig }
  | { type: "marker"; markerId: string };

const DEFAULT_FILL = "#bfbfbf";
const SVG_NS = "http://www.w3.org/2000/svg";

const getCountryTitle = (path: SVGPathElement) => {
  const localTitle = path.querySelector("title");
  if (localTitle?.textContent) return localTitle.textContent.trim();

  const parentTitle = path.parentElement?.querySelector("title");
  if (parentTitle?.textContent) return parentTitle.textContent.trim();

  return path.id || "Unknown";
};

export default function MapBuilder() {
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedCountryName, setSelectedCountryName] = useState<string>("");
  const [countryColor, setCountryColor] = useState<string>(DEFAULT_FILL);
  const [countryPopup, setCountryPopup] = useState<string>("");
  const [countryLink, setCountryLink] = useState<string>("");
  const [markerLabel, setMarkerLabel] = useState<string>("");
  const [markerLink, setMarkerLink] = useState<string>("");
  const [markerColor, setMarkerColor] = useState<string>("#e24b4b");
  const [markerMode, setMarkerMode] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareCid, setShareCid] = useState<string>("");
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [popupState, setPopupState] = useState<PopupState>({
    isVisible: false,
    title: "",
    body: "",
    link: "",
    x: 0,
    y: 0,
  });

  const mapSurfaceRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const markerLayerRef = useRef<SVGGElement | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const markerIdRef = useRef(0);
  const configsRef = useRef<Record<string, CountryConfig>>({});
  const markerStateRef = useRef({
    mode: markerMode,
    label: markerLabel,
    link: markerLink,
    color: markerColor,
  });

  useEffect(() => {
    markerStateRef.current = {
      mode: markerMode,
      label: markerLabel,
      link: markerLink,
      color: markerColor,
    };
  }, [markerMode, markerLabel, markerLink, markerColor]);

  const getConfig = useCallback((countryId: string): CountryConfig => {
    if (!configsRef.current[countryId]) {
      configsRef.current[countryId] = {
        fill: DEFAULT_FILL,
        popupText: "",
        link: "",
      };
    }
    return configsRef.current[countryId];
  }, []);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    historyRef.current = [...historyRef.current, entry];
    setCanUndo(true);
  }, []);

  const updateCountryFill = useCallback((countryId: string, fill: string) => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const path = svgElement.querySelector<SVGPathElement>(
      `#${CSS.escape(countryId)}`
    );
    if (!path) return;
    path.style.fill = fill;
  }, []);

  const selectCountry = useCallback(
    (path: SVGPathElement) => {
      const svgElement = svgRef.current;
      if (!svgElement) return;

      svgElement
        .querySelectorAll<SVGPathElement>("path.landxx")
        .forEach((item) => item.classList.remove("is-selected"));

      path.classList.add("is-selected");

      const config = getConfig(path.id);
      const name = path.getAttribute("data-country") || path.id;

      setSelectedCountryId(path.id);
      setSelectedCountryName(name);
      setCountryColor(config.fill || DEFAULT_FILL);
      setCountryPopup(config.popupText);
      setCountryLink(config.link);
    },
    [getConfig]
  );

  const clearSelection = useCallback(() => {
    const svgElement = svgRef.current;
    if (svgElement) {
      svgElement
        .querySelectorAll<SVGPathElement>("path.landxx")
        .forEach((item) => item.classList.remove("is-selected"));
    }

    setSelectedCountryId(null);
    setSelectedCountryName("");
    setCountryColor(DEFAULT_FILL);
    setCountryPopup("");
    setCountryLink("");
    setPopupState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const showPopup = useCallback(
    (path: SVGPathElement, event: MouseEvent) => {
      const config = getConfig(path.id);
      const containerBounds = mapSurfaceRef.current?.getBoundingClientRect();
      if (!containerBounds) return;

      setPopupState({
        isVisible: true,
        title: path.getAttribute("data-country") || path.id,
        body: config.popupText.trim() || "No pop-up content yet.",
        link: config.link.trim(),
        x: event.clientX - containerBounds.left,
        y: event.clientY - containerBounds.top,
      });
    },
    [getConfig]
  );

  const commitCountryDetails = useCallback(() => {
    if (!selectedCountryId) return;
    const config = getConfig(selectedCountryId);
    const next = {
      fill: config.fill,
      popupText: countryPopup,
      link: countryLink,
    };
    if (
      config.popupText === next.popupText &&
      config.link === next.link
    ) {
      return;
    }
    pushHistory({
      type: "country",
      countryId: selectedCountryId,
      prev: { ...config },
    });
    config.popupText = next.popupText;
    config.link = next.link;
  }, [countryLink, countryPopup, getConfig, pushHistory, selectedCountryId]);

  const addMarker = useCallback((event: MouseEvent) => {
    const svgElement = svgRef.current;
    const markerLayer = markerLayerRef.current;
    if (!svgElement || !markerLayer) return;

    const ctm = svgElement.getScreenCTM();
    if (!ctm) return;

    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(ctm.inverse());

    const group = document.createElementNS(SVG_NS, "g");
    const markerId = `marker-${markerIdRef.current++}`;
    const circle = document.createElementNS(SVG_NS, "circle");

    group.setAttribute("data-marker-id", markerId);
    circle.setAttribute("cx", svgPoint.x.toFixed(2));
    circle.setAttribute("cy", svgPoint.y.toFixed(2));
    circle.setAttribute("r", "8");
    circle.setAttribute("class", "marker-dot");
    circle.setAttribute("fill", markerStateRef.current.color || "#e24b4b");

    group.appendChild(circle);

    if (markerStateRef.current.label.trim()) {
      const label = document.createElementNS(SVG_NS, "text");
      label.textContent = markerStateRef.current.label.trim();
      label.setAttribute("x", (svgPoint.x + 12).toFixed(2));
      label.setAttribute("y", (svgPoint.y + 4).toFixed(2));
      label.setAttribute("class", "marker-label");
      group.appendChild(label);
    }

    if (markerStateRef.current.link.trim()) {
      const anchor = document.createElementNS(SVG_NS, "a");
      anchor.setAttribute("href", markerStateRef.current.link.trim());
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener");
      anchor.setAttribute("data-marker-id", markerId);
      anchor.appendChild(group);
      markerLayer.appendChild(anchor);
    } else {
      markerLayer.appendChild(group);
    }
    pushHistory({ type: "marker", markerId });
  }, [pushHistory]);

  const exportPNG = useCallback(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    setPopupState((prev) => ({ ...prev, isVisible: false }));

    if (!svgElement.getAttribute("xmlns")) {
      svgElement.setAttribute("xmlns", SVG_NS);
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const image = new Image();
    const viewBox = svgElement.viewBox.baseVal;
    const width = viewBox.width || svgElement.clientWidth || 2000;
    const height = viewBox.height || svgElement.clientHeight || 1000;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#f3efe7";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "world-map.png";
        link.click();
        URL.revokeObjectURL(downloadUrl);
      });

      URL.revokeObjectURL(url);
    };

    image.src = url;
  }, []);

  const buildPNGBlob = useCallback(async () => {
    const svgElement = svgRef.current;
    if (!svgElement) return null;

    setPopupState((prev) => ({ ...prev, isVisible: false }));

    if (!svgElement.getAttribute("xmlns")) {
      svgElement.setAttribute("xmlns", SVG_NS);
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const image = new Image();
    const viewBox = svgElement.viewBox.baseVal;
    const width = viewBox.width || svgElement.clientWidth || 2000;
    const height = viewBox.height || svgElement.clientHeight || 1000;

    const blob = await new Promise<Blob | null>((resolve) => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = "#f3efe7";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        canvas.toBlob((canvasBlob) => {
          resolve(canvasBlob);
        });
      };

      image.onerror = () => resolve(null);
      image.src = url;
    });

    URL.revokeObjectURL(url);
    return blob;
  }, []);

  const shareMap = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareUrl("");
    setShareCid("");

    try {
      const pngBlob = await buildPNGBlob();
      if (!pngBlob) {
        setIsSharing(false);
        return;
      }

      const formData = new FormData();
      formData.append(
        "file",
        new File([pngBlob], "custom-world-map.png", { type: "image/png" })
      );

      const response = await fetch("/api/ipfs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setIsSharing(false);
        return;
      }

      const data = (await response.json()) as { cid: string; url: string };
      setShareUrl(data.url);
      setShareCid(data.cid);
    } catch (error) {
    } finally {
      setIsSharing(false);
    }
  }, [buildPNGBlob, isSharing]);

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleColorChange = useCallback(
    (value: string) => {
      setCountryColor(value);
      if (!selectedCountryId) return;
      const config = getConfig(selectedCountryId);
      if (config.fill === value) return;
      pushHistory({
        type: "country",
        countryId: selectedCountryId,
        prev: { ...config },
      });
      config.fill = value;
      updateCountryFill(selectedCountryId, value);
    },
    [getConfig, pushHistory, selectedCountryId, updateCountryFill]
  );

  const undoLast = useCallback(() => {
    const history = historyRef.current;
    const entry = history.pop();
    setCanUndo(history.length > 0);
    if (!entry) return;

    if (entry.type === "country") {
      const config = getConfig(entry.countryId);
      config.fill = entry.prev.fill;
      config.popupText = entry.prev.popupText;
      config.link = entry.prev.link;
      updateCountryFill(entry.countryId, entry.prev.fill || DEFAULT_FILL);
      if (selectedCountryId === entry.countryId) {
        setCountryColor(entry.prev.fill || DEFAULT_FILL);
        setCountryPopup(entry.prev.popupText);
        setCountryLink(entry.prev.link);
      }
      return;
    }

    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    const marker = markerLayer.querySelector(
      `[data-marker-id=\"${entry.markerId}\"]`
    );
    if (marker) {
      marker.remove();
    }
  }, [getConfig, selectedCountryId, updateCountryFill]);

  useEffect(() => {
    let isMounted = true;
    fetch("/world.svg")
      .then((response) => response.text())
      .then((data) => {
        if (!isMounted) return;
        setSvgMarkup(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setSvgMarkup("");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!svgMarkup) return;
    const surface = mapSurfaceRef.current;
    if (!surface) return;

    surface.innerHTML = svgMarkup;

    const svgElement = surface.querySelector("svg");
    if (!svgElement) return;

    svgElement.setAttribute("id", "world-map");
    if (!svgElement.getAttribute("viewBox")) {
      const width = Number(svgElement.getAttribute("width")) || 2754;
      const height = Number(svgElement.getAttribute("height")) || 1398;
      svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgRef.current = svgElement;

    const injectedStyle = document.createElementNS(SVG_NS, "style");
    injectedStyle.textContent = `
      .oceanxx { fill: #b9d6e6; }
      .landxx {
        fill: ${DEFAULT_FILL};
        stroke: #6f5e4a;
        stroke-width: 0.6;
        cursor: pointer;
        transition: fill 0.2s ease;
      }
      .landxx:hover { fill: #caa986; }
      .landxx.is-selected { stroke: #1f3a3d; stroke-width: 2; }
      .marker-dot { stroke: #ffffff; stroke-width: 2; }
      .marker-label {
        font: 14px "Source Sans 3", sans-serif;
        fill: #2b2b2b;
        paint-order: stroke;
        stroke: #ffffff;
        stroke-width: 3;
      }
    `;

    svgElement.prepend(injectedStyle);

    let markerLayer = svgElement.querySelector<SVGGElement>("#markers-layer");
    if (!markerLayer) {
      markerLayer = document.createElementNS(SVG_NS, "g");
      markerLayer.setAttribute("id", "markers-layer");
      svgElement.appendChild(markerLayer);
    }
    markerLayerRef.current = markerLayer;

    const landPaths = Array.from(
      svgElement.querySelectorAll<SVGPathElement>("path.landxx")
    );

    landPaths.forEach((path) => {
      path.setAttribute("data-country", getCountryTitle(path));
    });

    const handleCountryClick = (event: MouseEvent) => {
      const target = event.currentTarget as SVGPathElement;
      if (!target) return;

      if (markerStateRef.current.mode) {
        addMarker(event);
        return;
      }

      selectCountry(target);
      showPopup(target, event);
    };

    const handleSvgClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("path.landxx")) return;
      if (markerStateRef.current.mode) {
        addMarker(event);
        return;
      }
      clearSelection();
    };

    landPaths.forEach((path) => {
      path.addEventListener("click", handleCountryClick);
    });
    svgElement.addEventListener("click", handleSvgClick);

    return () => {
      landPaths.forEach((path) => {
        path.removeEventListener("click", handleCountryClick);
      });
      svgElement.removeEventListener("click", handleSvgClick);
    };
  }, [addMarker, clearSelection, selectCountry, showPopup, svgMarkup]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMarkerMode(false);
      setPopupState((prev) => ({ ...prev, isVisible: false }));
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Atlas Studio</p>
          <h1>Build your custom World Map</h1>
          <p className="subhead">
            Click countries to colour them, attach notes and links, drop markers,
            and export your custom map as a PNG.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Country Editor</h2>
          <div className="field">
            <label htmlFor="selected-country">Selected country</label>
            <input
              id="selected-country"
              type="text"
              value={selectedCountryName}
              placeholder="Click a country"
              readOnly
            />
          </div>
          <div className="field">
            <label htmlFor="country-color">Fill color</label>
            <input
              id="country-color"
              type="color"
              value={countryColor}
              onChange={(event) => handleColorChange(event.target.value)}
              style={{ backgroundColor: countryColor }}
            />
          </div>
          <div className="field">
            <label htmlFor="country-popup">Pop-up text</label>
            <textarea
              id="country-popup"
              rows={3}
              value={countryPopup}
              onChange={(event) => setCountryPopup(event.target.value)}
              placeholder="Add note"
              onBlur={commitCountryDetails}
            />
          </div>
          <div className="field">
            <label htmlFor="country-link">Link (optional)</label>
            <input
              id="country-link"
              type="url"
              value={countryLink}
              onChange={(event) => setCountryLink(event.target.value)}
              placeholder="https://"
              onBlur={commitCountryDetails}
            />
          </div>
          <div className="actions">
          </div>

          <h2>Markers</h2>
          <div className="field">
            <label htmlFor="marker-label">Marker label</label>
            <input
              id="marker-label"
              type="text"
              value={markerLabel}
              onChange={(event) => setMarkerLabel(event.target.value)}
              placeholder="e.g. Launch Event"
            />
          </div>
          <div className="field">
            <label htmlFor="marker-link">Marker link</label>
            <input
              id="marker-link"
              type="url"
              value={markerLink}
              onChange={(event) => setMarkerLink(event.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="field">
            <label htmlFor="marker-color">Marker color</label>
            <input
              id="marker-color"
              type="color"
              value={markerColor}
              onChange={(event) => setMarkerColor(event.target.value)}
            />
          </div>
          <div className="actions">
            <button
              className={`secondary ${markerMode ? "active" : ""}`}
              onClick={() => setMarkerMode((prev) => !prev)}
            >
              {markerMode ? "Placing Markers..." : "Place Marker"}
            </button>
            <button
                className="ghost compact"
                onClick={undoLast}
                disabled={!canUndo}
              >
                Undo
              </button>
          </div>
        </section>

        <section className="map-stage">
          <div className="map-shell">
            <div className="map-toolbar">
            </div>
            <div className="map-surface" ref={mapSurfaceRef} />
            {!svgMarkup && (
              <div className="map-loading">Loading map...</div>
            )}
            {popupState.isVisible && (
              <div
                className="map-popup"
                style={{ left: popupState.x, top: popupState.y }}
              >
                <strong>{popupState.title}</strong>
                <p>{popupState.body}</p>
                {popupState.link ? (
                  <a href={popupState.link} target="_blank" rel="noopener">
                    Open link
                  </a>
                ) : null}
              </div>
            )}
          </div>
          <div className="map-meta">
            <p>
              Map source: Wikimedia Commons
            </p>
            <div className="share-actions">
              <button className="primary compact" onClick={exportPNG}>
                Export PNG
              </button>
              {!shareUrl ? (
                <button
                  className="primary compact share"
                  onClick={shareMap}
                  disabled={isSharing}
                >
                  {isSharing ? "Preparing..." : "Share"}
                </button>
              ) : (
                <>
                  <button className="ghost compact" onClick={copyShareUrl}>
                    Copy URL
                  </button>
                  <a
                    className="ghost compact"
                    href={`mailto:?subject=Custom%20World%20Map&body=${encodeURIComponent(
                      shareUrl
                    )}`}
                  >
                    Email
                  </a>
                  <a
                    className="ghost compact"
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      shareUrl
                    )}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Telegram
                  </a>
                </>
              )}
            </div>
            {shareUrl ? (
              <p className="share-url">
                {shareUrl} {shareCid ? `(${shareCid})` : ""}
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
