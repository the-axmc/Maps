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

type MapKey =
  | "world"
  | "northAmerica"
  | "southAmerica"
  | "europe"
  | "africa"
  | "asia"
  | "oceania";

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_FILL = "#caa986";
const ORIGINAL_FILL = "#bfbfbf";
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_HISTORY = 100;

const CONTINENT_BOUNDS: Record<
  Exclude<MapKey, "world">,
  { x: number; y: number; width: number; height: number }
> = {
  northAmerica: { x: 0.03, y: 0.04, width: 0.43, height: 0.46 },
  southAmerica: { x: 0.20, y: 0.38, width: 0.23, height: 0.52 },
  europe: { x: 0.40, y: 0.06, width: 0.20, height: 0.28 },
  africa: { x: 0.41, y: 0.24, width: 0.22, height: 0.50 },
  asia: { x: 0.55, y: 0.08, width: 0.42, height: 0.48 },
  oceania: { x: 0.75, y: 0.50, width: 0.22, height: 0.36 },
};

const toViewBox = (bounds: { x: number; y: number; width: number; height: number }, world: ViewBox): ViewBox => ({
  x: world.x + world.width * bounds.x,
  y: world.y + world.height * bounds.y,
  width: world.width * bounds.width,
  height: world.height * bounds.height,
});

const getContinentForPoint = (point: { x: number; y: number }, world: ViewBox): Exclude<MapKey, "world"> | null => {
  const entries = Object.entries(CONTINENT_BOUNDS) as Array<
    [Exclude<MapKey, "world">, { x: number; y: number; width: number; height: number }]
  >;
  for (const [key, bounds] of entries) {
    const viewBox = toViewBox(bounds, world);
    const withinX = point.x >= viewBox.x && point.x <= viewBox.x + viewBox.width;
    const withinY = point.y >= viewBox.y && point.y <= viewBox.y + viewBox.height;
    if (withinX && withinY) return key;
  }
  return null;
};

const getCountryTitle = (element: SVGElement) => {
  const localTitle = element.querySelector("title");
  if (localTitle?.textContent) return localTitle.textContent.trim();

  const parentTitle = element.parentElement?.querySelector("title");
  if (parentTitle?.textContent) return parentTitle.textContent.trim();

  return element.id || "Unknown";
};

export default function MapBuilder() {
  const donateAddress = "0x7dfaD7deD1B3351D8BA46703b47296056688c664";
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [activeMap, setActiveMap] = useState<MapKey>("world");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedCountryName, setSelectedCountryName] = useState<string>("");
  const [countryColor, setCountryColor] = useState<string>(DEFAULT_FILL);
  const [countryPopup, setCountryPopup] = useState<string>("");
  const [countryLink, setCountryLink] = useState<string>("");
  const [hasPickedFillColor, setHasPickedFillColor] = useState<boolean>(false);
  const [markerLabel, setMarkerLabel] = useState<string>("");
  const [markerLink, setMarkerLink] = useState<string>("");
  const [markerColor, setMarkerColor] = useState<string>("#e24b4b");
  const [markerMode, setMarkerMode] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareCid, setShareCid] = useState<string>("");
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string>("");
  const [hasCopiedShareUrl, setHasCopiedShareUrl] = useState<boolean>(false);
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(false);
  const [hasCopiedDonate, setHasCopiedDonate] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [canUndoCountry, setCanUndoCountry] = useState<boolean>(false);
  const [canUndoMarker, setCanUndoMarker] = useState<boolean>(false);
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
  const copyTimeoutRef = useRef<number | null>(null);
  const donateCopyTimeoutRef = useRef<number | null>(null);
  const worldViewBoxRef = useRef<ViewBox | null>(null);
  const activeMapRef = useRef<MapKey>(activeMap);
  const zoomLevelRef = useRef(0);
  const labelLayerRef = useRef<SVGGElement | null>(null);
  const dragStartRef = useRef<{
    point: { x: number; y: number };
    viewBox: ViewBox;
  } | null>(null);
  const markerStateRef = useRef({
    mode: markerMode,
    label: markerLabel,
    link: markerLink,
    color: markerColor,
  });
  const addMarkerRef = useRef<(event: MouseEvent) => void>(() => {});
  const refreshLabelsRef = useRef<() => void>(() => {});
  const selectCountryRef = useRef<(element: SVGGraphicsElement) => void>(() => {});
  const showPopupRef = useRef<
    (element: SVGGraphicsElement, event: MouseEvent) => void
  >(() => {});

  const sanitizeSvg = useCallback((rawSvg: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;

    svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());

    svg.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }
        if ((name === "href" || name === "xlink:href") && /^https?:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });

    return svg;
  }, []);

  useEffect(() => {
    markerStateRef.current = {
      mode: markerMode,
      label: markerLabel,
      link: markerLink,
      color: markerColor,
    };
  }, [markerMode, markerLabel, markerLink, markerColor]);

  const getPrimaryLandBox = useCallback((element: SVGGraphicsElement) => {
    if (element.tagName.toLowerCase() !== "g") {
      return element.getBBox();
    }
    const parts = Array.from(
      element.querySelectorAll<SVGGraphicsElement>(".landxx")
    );
    if (!parts.length) {
      return element.getBBox();
    }
    let largest = parts[0].getBBox();
    let largestArea = largest.width * largest.height;
    parts.forEach((part) => {
      const box = part.getBBox();
      const area = box.width * box.height;
      if (area > largestArea) {
        largest = box;
        largestArea = area;
      }
    });
    return largest;
  }, []);

  const refreshLabels = useCallback(() => {
    const svgElement = svgRef.current;
    const labelLayer = labelLayerRef.current;
    if (!svgElement || !labelLayer) return;
    labelLayer.innerHTML = "";
    if (!showLabels) return;

    const allLandElements = Array.from(
      svgElement.querySelectorAll<SVGGraphicsElement>(".landxx")
    );
    const landElements = allLandElements.filter(
      (element) => !element.parentElement?.closest(".landxx")
    );

    const coloredIds = Object.entries(configsRef.current)
      .filter(([, config]) => config.fill && config.fill !== ORIGINAL_FILL)
      .map(([key]) => key);
    if (selectedCountryId && !coloredIds.includes(selectedCountryId)) {
      coloredIds.push(selectedCountryId);
    }
    const filterToColored = coloredIds.length > 0;
    const eligibleSet = new Set(coloredIds);
    const eligibleElements = filterToColored
      ? landElements.filter((element) => eligibleSet.has(element.id))
      : landElements;

    const worldViewBox = worldViewBoxRef.current;
    const viewBox = svgElement.viewBox.baseVal;
    const zoomScale =
      worldViewBox && viewBox.width
        ? worldViewBox.width / viewBox.width
        : 1;
    const baseFontSize =
      activeMapRef.current === "world" && zoomLevelRef.current === 0 ? 16 : 12;
    const fontSizeValue = baseFontSize / zoomScale;
    const fontSize = fontSizeValue.toFixed(2);
    const strokeWidth = (4 / zoomScale).toFixed(2);

    eligibleElements.forEach((element) => {
      const config = configsRef.current[element.id];
      const isSelected = selectedCountryId === element.id;
      const body = isSelected
        ? countryPopup.trim()
        : config?.popupText?.trim();
      const box = getPrimaryLandBox(element);
      if (!box || box.width === 0 || box.height === 0) return;

      const labelGroup = document.createElementNS(SVG_NS, "g");
      labelGroup.setAttribute("class", "country-label-group");
      labelGroup.setAttribute("pointer-events", "none");

      const name = isSelected
        ? selectedCountryName || element.getAttribute("data-country") || element.id
        : element.getAttribute("data-country") || element.id;
      const labelText = document.createElementNS(SVG_NS, "text");
      labelText.setAttribute("class", "country-label");
      labelText.setAttribute("font-size", fontSize);
      labelText.setAttribute("stroke-width", strokeWidth);
      labelText.setAttribute("text-anchor", "middle");
      labelText.setAttribute("dominant-baseline", "middle");
      labelText.setAttribute("x", "0");
      labelText.setAttribute("y", "0");
      labelText.textContent = body ? `${name} — ${body}` : name;
      labelGroup.appendChild(labelText);

      labelLayer.appendChild(labelGroup);

      const textBox = labelGroup.getBBox();
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      labelGroup.setAttribute(
        "transform",
        `translate(${centerX.toFixed(2)} ${centerY.toFixed(2)})`
      );
    });
  }, [countryPopup, getPrimaryLandBox, selectedCountryId, selectedCountryName, showLabels]);


  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const applyViewBox = useCallback((viewBox: ViewBox) => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    svgElement.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    );
  }, []);

  const clampViewBox = useCallback((viewBox: ViewBox) => {
    const worldViewBox = worldViewBoxRef.current;
    if (!worldViewBox) return viewBox;
    const maxX = worldViewBox.x + worldViewBox.width - viewBox.width;
    const maxY = worldViewBox.y + worldViewBox.height - viewBox.height;
    return {
      x: Math.min(Math.max(viewBox.x, worldViewBox.x), maxX),
      y: Math.min(Math.max(viewBox.y, worldViewBox.y), maxY),
      width: viewBox.width,
      height: viewBox.height,
    };
  }, []);

  const getSvgPoint = useCallback((event: WheelEvent) => {
    const svgElement = svgRef.current;
    if (!svgElement) return null;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return null;
    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(ctm.inverse());
  }, []);

  const getSvgPointFromMouse = useCallback((event: MouseEvent) => {
    const svgElement = svgRef.current;
    if (!svgElement) return null;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return null;
    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(ctm.inverse());
  }, []);

  const getSelectedCountryPoint = useCallback(() => {
    if (!selectedCountryId) return null;
    const svgElement = svgRef.current;
    if (!svgElement) return null;
    const path = svgElement.querySelector<SVGGraphicsElement>(
      `#${CSS.escape(selectedCountryId)}`
    );
    if (!path) return null;
    const box = getPrimaryLandBox(path);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }, [getPrimaryLandBox, selectedCountryId]);

  const zoomToSelectedArea = useCallback(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const point = getSelectedCountryPoint();
    if (!point || !selectedCountryId) return;

    const path = svgElement.querySelector<SVGGraphicsElement>(
      `#${CSS.escape(selectedCountryId)}`
    );
    if (!path) return;

    if (zoomLevelRef.current >= 5) return;

    if (zoomLevelRef.current > 0) {
      const current = svgElement.viewBox.baseVal;
      const nextWidth = current.width / 2;
      const nextHeight = current.height / 2;
      const nextViewBox = clampViewBox({
        x: point.x - nextWidth / 2,
        y: point.y - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      });
      applyViewBox(nextViewBox);
      setZoomLevel((prev) => Math.min(prev + 1, 5));
      return;
    }

    const box = getPrimaryLandBox(path);
    const paddingX = box.width * 0.4 + 20;
    const paddingY = box.height * 0.4 + 20;
    applyViewBox(
      clampViewBox({
        x: box.x - paddingX,
        y: box.y - paddingY,
        width: box.width + paddingX * 2,
        height: box.height + paddingY * 2,
      })
    );
    setZoomLevel(1);
  }, [applyViewBox, clampViewBox, getPrimaryLandBox, getSelectedCountryPoint, selectedCountryId]);

  const zoomOutToWorld = useCallback(() => {
    const svgElement = svgRef.current;
    const worldViewBox = worldViewBoxRef.current;
    if (!worldViewBox || !svgElement) return;

    if (zoomLevelRef.current > 1) {
      const current = svgElement.viewBox.baseVal;
      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;
      const nextViewBox = clampViewBox({
        x: centerX - current.width,
        y: centerY - current.height,
        width: current.width * 2,
        height: current.height * 2,
      });
      applyViewBox(nextViewBox);
      setZoomLevel((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (zoomLevelRef.current === 1) {
      applyViewBox(worldViewBox);
      setZoomLevel(0);
      return;
    }

    if (activeMapRef.current !== "world") {
      setActiveMap("world");
    }
  }, [applyViewBox, clampViewBox]);

  useEffect(() => {
    setHasCopiedShareUrl(false);
  }, [shareUrl]);

  useEffect(() => {
    return () => {
      if (donateCopyTimeoutRef.current) {
        window.clearTimeout(donateCopyTimeoutRef.current);
      }
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const copyDonateAddress = useCallback(async () => {
    await navigator.clipboard.writeText(donateAddress);
    setHasCopiedDonate(true);
    if (donateCopyTimeoutRef.current) {
      window.clearTimeout(donateCopyTimeoutRef.current);
    }
    donateCopyTimeoutRef.current = window.setTimeout(() => {
      setHasCopiedDonate(false);
    }, 2000);
  }, [donateAddress]);

  const getConfig = useCallback((countryId: string): CountryConfig => {
    if (!configsRef.current[countryId]) {
      configsRef.current[countryId] = {
        fill: ORIGINAL_FILL,
        popupText: "",
        link: "",
      };
    }
    return configsRef.current[countryId];
  }, []);

  const updateUndoState = useCallback((history: HistoryEntry[]) => {
    setCanUndoCountry(history.some((item) => item.type === "country"));
    setCanUndoMarker(history.some((item) => item.type === "marker"));
  }, []);

  const pushHistory = useCallback(
    (entry: HistoryEntry) => {
      const next = [...historyRef.current, entry].slice(-MAX_HISTORY);
      historyRef.current = next;
      updateUndoState(next);
    },
    [updateUndoState]
  );

  const updateCountryFill = useCallback((countryId: string, fill: string) => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const element = svgElement.querySelector<SVGGraphicsElement>(
      `#${CSS.escape(countryId)}`
    );
    if (!element) return;
    element.style.fill = fill;
    if (element.tagName.toLowerCase() === "g") {
      element
        .querySelectorAll<SVGGraphicsElement>(
          "path, polygon, circle, rect, ellipse"
        )
        .forEach((node) => {
          node.style.fill = fill;
        });
    }
  }, []);

  const selectCountry = useCallback(
    (element: SVGGraphicsElement) => {
      const svgElement = svgRef.current;
      if (!svgElement) return;

      svgElement
        .querySelectorAll<SVGGraphicsElement>(".landxx")
        .forEach((item) => item.classList.remove("is-selected"));

      element.classList.add("is-selected");

      const config = getConfig(element.id);
      const name = element.getAttribute("data-country") || element.id;
      let fillToApply = config.fill || ORIGINAL_FILL;
      if (fillToApply === ORIGINAL_FILL) {
        fillToApply = hasPickedFillColor ? countryColor : DEFAULT_FILL;
        pushHistory({
          type: "country",
          countryId: element.id,
          prev: { ...config },
        });
        config.fill = fillToApply;
      }
      updateCountryFill(element.id, fillToApply);
      refreshLabels();

      setSelectedCountryId(element.id);
      setSelectedCountryName(name);
      setCountryColor(fillToApply);
      setCountryPopup(config.popupText);
      setCountryLink(config.link);
    },
    [countryColor, getConfig, hasPickedFillColor, pushHistory, refreshLabels, updateCountryFill]
  );

  const showPopup = useCallback(
    (element: SVGGraphicsElement, event: MouseEvent) => {
      const config = getConfig(element.id);
      const body = config.popupText.trim();
      if (!body) {
        setPopupState((prev) => ({ ...prev, isVisible: false }));
        return;
      }
      const containerBounds = mapSurfaceRef.current?.getBoundingClientRect();
      if (!containerBounds) return;

      setPopupState({
        isVisible: true,
        title: element.getAttribute("data-country") || element.id,
        body,
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
    refreshLabelsRef.current();
  }, [
    countryLink,
    countryPopup,
    getConfig,
    pushHistory,
    refreshLabels,
    selectedCountryId,
  ]);

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

  useEffect(() => {
    addMarkerRef.current = addMarker;
  }, [addMarker]);

  useEffect(() => {
    refreshLabelsRef.current = refreshLabels;
  }, [refreshLabels]);

  useEffect(() => {
    selectCountryRef.current = selectCountry;
  }, [selectCountry]);

  useEffect(() => {
    showPopupRef.current = showPopup;
  }, [showPopup]);

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
    setShareError("");

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
        if (response.status === 429) {
          setShareError("Share limit reached. Please wait 24h and try again.");
        } else {
          const errorText = await response.text();
          setShareError(errorText || "Share failed. Please try again.");
        }
        setIsSharing(false);
        return;
      }

      const data = (await response.json()) as { cid: string; url: string };
      setShareUrl(data.url);
      setShareCid(data.cid);
    } catch (error) {
      console.error("Share upload failed", error);
      setShareError("Share failed. Please try again.");
    } finally {
      setIsSharing(false);
    }
  }, [buildPNGBlob, isSharing]);

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setHasCopiedShareUrl(true);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setHasCopiedShareUrl(false);
    }, 2000);
  }, [shareUrl]);

  const handleColorChange = useCallback(
    (value: string) => {
      setCountryColor(value);
      setHasPickedFillColor(true);
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
      refreshLabels();
    },
    [getConfig, pushHistory, refreshLabels, selectedCountryId, updateCountryFill]
  );

  const undoCountry = useCallback(() => {
    const history = [...historyRef.current];
    const entryIndex = [...history]
      .reverse()
      .findIndex((item) => item.type === "country");
    if (entryIndex === -1) return;
    const index = history.length - 1 - entryIndex;
    const [entry] = history.splice(index, 1);
    historyRef.current = history;
    updateUndoState(history);
    if (!entry || entry.type !== "country") return;

    const config = getConfig(entry.countryId);
    config.fill = ORIGINAL_FILL;
    updateCountryFill(entry.countryId, ORIGINAL_FILL);
    if (selectedCountryId === entry.countryId) {
      setCountryColor(ORIGINAL_FILL);
    }
    refreshLabels();
  }, [getConfig, refreshLabels, selectedCountryId, updateCountryFill, updateUndoState]);

  const undoMarker = useCallback(() => {
    const history = [...historyRef.current];
    const entryIndex = [...history]
      .reverse()
      .findIndex((item) => item.type === "marker");
    if (entryIndex === -1) return;
    const index = history.length - 1 - entryIndex;
    const [entry] = history.splice(index, 1);
    historyRef.current = history;
    updateUndoState(history);
    if (!entry || entry.type !== "marker") return;
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    const marker = markerLayer.querySelector(
      `[data-marker-id=\"${entry.markerId}\"]`
    );
    if (marker) {
      marker.remove();
    }
  }, [updateUndoState]);

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

    surface.innerHTML = "";
    const sanitizedSvg = sanitizeSvg(svgMarkup);
    if (!sanitizedSvg) return;
    const svgElement = sanitizedSvg as SVGSVGElement;
    surface.appendChild(svgElement);
    if (!svgElement) return;

    svgElement.setAttribute("id", "world-map");
    if (!svgElement.getAttribute("viewBox")) {
      const width = Number(svgElement.getAttribute("width")) || 2754;
      const height = Number(svgElement.getAttribute("height")) || 1398;
      svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgRef.current = svgElement;

    const baseViewBox = svgElement.viewBox.baseVal;
    const worldViewBox: ViewBox = {
      x: baseViewBox.x,
      y: baseViewBox.y,
      width: baseViewBox.width,
      height: baseViewBox.height,
    };
    worldViewBoxRef.current = worldViewBox;
    if (activeMapRef.current === "world") {
      applyViewBox(worldViewBox);
    } else {
      applyViewBox(
        toViewBox(CONTINENT_BOUNDS[activeMapRef.current], worldViewBox)
      );
    }

    const injectedStyle = document.createElementNS(SVG_NS, "style");
    injectedStyle.textContent = `
      .oceanxx { fill: #b9d6e6; }
      .landxx {
        fill: ${ORIGINAL_FILL};
        stroke: #6f5e4a;
        stroke-width: 0.6;
        cursor: pointer;
        transition: fill 0.2s ease;
      }
      .landxx:hover { fill: #caa986; }
      .landxx.is-selected { stroke: none; }
      .marker-dot { stroke: #ffffff; stroke-width: 2; }
      .marker-label {
        font: 14px "Source Sans 3", sans-serif;
        fill: #2b2b2b;
        paint-order: stroke;
        stroke: #ffffff;
        stroke-width: 3;
      }
      .country-label {
        font: 12px "Source Sans 3", sans-serif;
        fill: #2b2b2b;
        paint-order: stroke;
        stroke: #ffffff;
        stroke-width: 4;
      }
      .country-label-box {
        fill: rgba(255, 255, 255, 0.92);
        stroke: #d6c8b8;
        stroke-width: 1;
      }
    `;

    svgElement.prepend(injectedStyle);

    let labelLayer = svgElement.querySelector<SVGGElement>("#labels-layer");
    if (!labelLayer) {
      labelLayer = document.createElementNS(SVG_NS, "g");
      labelLayer.setAttribute("id", "labels-layer");
      svgElement.appendChild(labelLayer);
    }
    labelLayerRef.current = labelLayer;

    let markerLayer = svgElement.querySelector<SVGGElement>("#markers-layer");
    if (!markerLayer) {
      markerLayer = document.createElementNS(SVG_NS, "g");
      markerLayer.setAttribute("id", "markers-layer");
      svgElement.appendChild(markerLayer);
    }
    markerLayerRef.current = markerLayer;

    svgElement.appendChild(markerLayer);

    const allLandElements = Array.from(
      svgElement.querySelectorAll<SVGGraphicsElement>(".landxx")
    );
    const landElements = allLandElements.filter(
      (element) => !element.parentElement?.closest(".landxx")
    );

    landElements.forEach((element) => {
      element.setAttribute("data-country", getCountryTitle(element));
    });

    refreshLabels();

    const getTopLandElement = (element: Element | null) => {
      let current = element?.closest(".landxx") as SVGGraphicsElement | null;
      if (!current) return null;
      while (current.parentElement?.closest(".landxx")) {
        current = current.parentElement.closest(".landxx") as SVGGraphicsElement;
      }
      return current;
    };

    const handleCountryClick = (event: MouseEvent) => {
      const target = event.currentTarget as Element | null;
      if (!target) return;
      const landElement = getTopLandElement(target);
      if (!landElement) return;

      if (markerStateRef.current.mode) {
        addMarkerRef.current(event);
        return;
      }

      selectCountryRef.current(landElement);
      showPopupRef.current(landElement, event);
    };

    const handleSvgClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".landxx")) return;
      if (markerStateRef.current.mode) {
        addMarkerRef.current(event);
        return;
      }
      setPopupState((prev) => ({ ...prev, isVisible: false }));
    };

    allLandElements.forEach((element) => {
      element.addEventListener("click", handleCountryClick);
    });
    svgElement.addEventListener("click", handleSvgClick);

    return () => {
      allLandElements.forEach((element) => {
        element.removeEventListener("click", handleCountryClick);
      });
      svgElement.removeEventListener("click", handleSvgClick);
    };
  }, [applyViewBox, svgMarkup]);

  useEffect(() => {
    refreshLabels();
  }, [activeMap, refreshLabels, showLabels, zoomLevel]);

  useEffect(() => {
    const worldViewBox = worldViewBoxRef.current;
    if (!worldViewBox) return;
    if (activeMap === "world") {
      applyViewBox(worldViewBox);
      return;
    }
    applyViewBox(toViewBox(CONTINENT_BOUNDS[activeMap], worldViewBox));
  }, [activeMap, applyViewBox]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMarkerMode(false);
      setPopupState((prev) => ({ ...prev, isVisible: false }));
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const surface = mapSurfaceRef.current;
    if (!surface) return;

    const handleWheel = (event: WheelEvent) => {
      if (!svgRef.current) return;
      const worldViewBox = worldViewBoxRef.current;
      if (!worldViewBox) return;
      if (event.deltaY === 0) return;
      event.preventDefault();

      const zoomingIn = event.deltaY < 0;
      if (zoomLevelRef.current > 0) {
        if (!zoomingIn) {
          zoomOutToWorld();
        }
        return;
      }

      if (zoomingIn && activeMapRef.current === "world") {
        const point = getSvgPoint(event);
        if (!point) return;
        const continent = getContinentForPoint(point, worldViewBox);
        if (!continent) return;
        setActiveMap(continent);
        return;
      }

      if (!zoomingIn && activeMapRef.current !== "world") {
        setActiveMap("world");
      }
    };

    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleWheel);
  }, [applyViewBox, getSvgPoint, zoomOutToWorld]);

  useEffect(() => {
    const surface = mapSurfaceRef.current;
    if (!surface) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (markerStateRef.current.mode) return;
      if (activeMapRef.current === "world" && zoomLevelRef.current === 0) return;
      const target = event.target as Element | null;
      if (target?.closest(".map-toolbar")) return;
      if (target?.closest(".map-popup")) return;

      const svgElement = svgRef.current;
      if (!svgElement) return;
      const point = getSvgPointFromMouse(event);
      if (!point) return;
      const box = svgElement.viewBox.baseVal;
      dragStartRef.current = {
        point,
        viewBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      };
      setIsDraggingMap(true);
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStartRef.current) return;
      const svgElement = svgRef.current;
      if (!svgElement) return;
      const point = getSvgPointFromMouse(event);
      if (!point) return;
      const start = dragStartRef.current;
      const dx = point.x - start.point.x;
      const dy = point.y - start.point.y;
      const nextViewBox = clampViewBox({
        x: start.viewBox.x - dx,
        y: start.viewBox.y - dy,
        width: start.viewBox.width,
        height: start.viewBox.height,
      });
      applyViewBox(nextViewBox);
    };

    const handleMouseUp = () => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;
      setIsDraggingMap(false);
    };

    surface.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      surface.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [applyViewBox, clampViewBox, getSvgPointFromMouse]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-title">
          <p className="eyebrow">Atlas Studio</p>
          <h1>Build your custom World Map</h1>
        </div>
        <p className="subhead">
          Click countries to colour them, attach notes and links, drop markers,
          and export your custom map as a PNG.
        </p>
        <div className="donate-slot">
          {isDonateOpen ? (
            <div className="donate-panel">
              <div className="donate-controls">
                <button
                  className="ghost compact donate-control"
                  onClick={copyDonateAddress}
                >
                  {hasCopiedDonate ? "Copied!" : "Copy address"}
                </button>
                <button
                  className="ghost compact donate-control"
                  onClick={() => setIsDonateOpen(false)}
                  aria-label="Close donation panel"
                >
                  ×
                </button>
              </div>
              <img
                className="donate-qr"
                src="/qr-code.png"
                alt="Ethereum donation QR code"
              />
            </div>
          ) : (
            <button
              className="primary donate-cta"
              onClick={() => setIsDonateOpen(true)}
            >
              Donate
            </button>
          )}
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
            <div className="color-input">
              <span
                className="color-swatch"
                style={{ backgroundColor: countryColor }}
                aria-hidden="true"
              />
              <input
                id="country-color"
                type="color"
                value={countryColor}
                onChange={(event) => handleColorChange(event.target.value)}
                aria-label="Choose fill color"
              />
            </div>
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
            <label>Map tools</label>
            <div className="actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setShowLabels((prev) => !prev)}
              >
                {showLabels ? "Hide labels" : "Show labels"}
              </button>
              <button
                className="ghost compact"
                type="button"
                onClick={undoCountry}
                disabled={!canUndoCountry}
              >
                Undo
              </button>
            </div>
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
            <div className="color-input">
              <span
                className="color-swatch"
                style={{ backgroundColor: markerColor }}
                aria-hidden="true"
              />
              <input
                id="marker-color"
                type="color"
                value={markerColor}
                onChange={(event) => setMarkerColor(event.target.value)}
                aria-label="Choose marker color"
              />
            </div>
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
              type="button"
              onClick={undoMarker}
              disabled={!canUndoMarker}
            >
              Undo
            </button>
          </div>
        </section>

        <section className="map-stage">
          <div
            className={`map-shell ${
              activeMap !== "world" || zoomLevel > 0 ? "is-zoomed" : ""
            } ${isDraggingMap ? "is-dragging" : ""}`}
          >
            <div className="map-toolbar">
              <div className="map-toolbar-card">
                <p className="map-toolbar-text">
                  <span>Pick a country, then tap + to zoom in</span>
                  <span>Tap - to step back out to the world view</span>
                  <span>When zoomed, drag the map to look around</span>
                </p>
                <div className="map-toolbar-actions">
                  <button
                    className="ghost compact"
                    onClick={zoomOutToWorld}
                    disabled={activeMap === "world" && zoomLevel === 0}
                    aria-label="Zoom out to world map"
                  >
                    -
                  </button>
                  <button
                    className="ghost compact"
                    onClick={zoomToSelectedArea}
                    disabled={
                      !selectedCountryId || activeMap !== "world" || zoomLevel >= 5
                    }
                    aria-label="Zoom in to selected country"
                  >
                    +
                  </button>
                </div>
              </div>
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
                    {hasCopiedShareUrl ? "Copied!" : "Copy URL"}
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
                  <a
                    className="ghost compact"
                    href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Whatsapp
                  </a>
                </>
              )}
            </div>
            {shareError ? (
              <p className="share-warning">{shareError}</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
