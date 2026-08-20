import { useEffect, useRef } from "react";
import {
  Map as MapLibre,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteOption } from "../types";

const DEFAULT_CENTER: [number, number] = [127.726, 34.834];

const defaultRouteCoordinates: Record<RouteOption["id"], [number, number][]> = {
  base: [
    [127.7188, 34.8806],
    [127.731, 34.862],
    [127.745, 34.842],
    [127.734, 34.818],
    [127.7161, 34.789],
  ],
  time: [
    [127.7188, 34.8806],
    [127.748, 34.861],
    [127.754, 34.832],
    [127.735, 34.808],
    [127.7161, 34.789],
  ],
  cost: [
    [127.7188, 34.8806],
    [127.708, 34.858],
    [127.716, 34.831],
    [127.706, 34.808],
    [127.7161, 34.789],
  ],
};

const buildLineFeature = (
  coordinates: [number, number][],
  routeId = "selected"
) => ({
  type: "Feature" as const,
  properties: { routeId },
  geometry: {
    type: "LineString" as const,
    coordinates,
  },
});

const buildStopsFeature = (coordinates: [number, number][]) => ({
  type: "FeatureCollection" as const,
  features:
    coordinates.length > 0
      ? [
          {
            type: "Feature" as const,
            properties: { kind: "origin" },
            geometry: { type: "Point" as const, coordinates: coordinates[0] },
          },
          {
            type: "Feature" as const,
            properties: { kind: "destination" },
            geometry: {
              type: "Point" as const,
              coordinates: coordinates[coordinates.length - 1],
            },
          },
        ]
      : [],
});

const createMapStyle = (
  selectedCoords: [number, number][],
  altCoords: [number, number][]
): StyleSpecification => ({
  version: 8,
  sources: {
    "carto-base": {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    "selected-route": {
      type: "geojson",
      data: buildLineFeature(selectedCoords, "selected"),
    },
    "alternative-route": {
      type: "geojson",
      data: buildLineFeature(altCoords, "alternative"),
    },
    "route-stops": { type: "geojson", data: buildStopsFeature(selectedCoords) },
  },
  layers: [
    { id: "carto-base", type: "raster", source: "carto-base" },
    {
      id: "route-outline",
      type: "line",
      source: "selected-route",
      paint: { "line-color": "#10233e", "line-width": 7, "line-opacity": 0.82 },
    },
    {
      id: "route-highlight",
      type: "line",
      source: "selected-route",
      paint: { "line-color": "#facc15", "line-width": 4.4, "line-opacity": 1 },
    },
    {
      id: "route-alternative",
      type: "line",
      source: "alternative-route",
      paint: {
        "line-color": "#6b7280",
        "line-width": 3.2,
        "line-dasharray": [1.2, 1.2],
        "line-opacity": 0.86,
      },
    },
    {
      id: "stop-outline",
      type: "circle",
      source: "route-stops",
      paint: {
        "circle-radius": 8,
        "circle-color": "#10233e",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.5,
      },
    },
    {
      id: "stop-center",
      type: "circle",
      source: "route-stops",
      paint: { "circle-radius": 3.5, "circle-color": "#facc15" },
    },
  ],
});

interface RouteMapProps {
  routeId?: RouteOption["id"];
  coordinates?: [number, number][];
  alternativeCoordinates?: [number, number][];
}

export function RouteMap({
  routeId = "base",
  coordinates,
  alternativeCoordinates,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const activeCoordinates =
    coordinates && coordinates.length > 0
      ? coordinates
      : (defaultRouteCoordinates[routeId] ?? defaultRouteCoordinates.base);

  const activeAltCoordinates =
    alternativeCoordinates && alternativeCoordinates.length > 0
      ? alternativeCoordinates
      : defaultRouteCoordinates[routeId === "base" ? "time" : "base"];

  // 1. 초기 맵 로드
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter =
      activeCoordinates.length > 0
        ? activeCoordinates[Math.floor(activeCoordinates.length / 2)]
        : DEFAULT_CENTER;

    const map = new MapLibre({
      container: containerRef.current,
      style: createMapStyle(activeCoordinates, activeAltCoordinates),
      center: initialCenter,
      zoom: 10.35,
      bearing: -8,
      pitch: 0,
      interactive: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;

    const fitToRoute = () => {
      if (activeCoordinates.length > 1) {
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        for (const [lng, lat] of activeCoordinates) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: 42,
            duration: 0,
            maxZoom: 13,
          }
        );
      }
    };

    map.on("load", fitToRoute);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. 동적 데이터 업데이트 처리 (타이밍 이슈 수정)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSources = () => {
      const selected = map.getSource("selected-route") as
        | GeoJSONSource
        | undefined;
      const alternative = map.getSource("alternative-route") as
        | GeoJSONSource
        | undefined;
      const stops = map.getSource("route-stops") as GeoJSONSource | undefined;

      selected?.setData(buildLineFeature(activeCoordinates, "selected"));
      alternative?.setData(
        buildLineFeature(activeAltCoordinates, "alternative")
      );
      stops?.setData(buildStopsFeature(activeCoordinates));

      if (activeCoordinates.length > 1) {
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        for (const [lng, lat] of activeCoordinates) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: 42,
            duration: 600,
            maxZoom: 13,
          }
        );
      }
    };

    // 지도가 완전히 렌더링된 상태라면 즉시 업데이트하고,
    // 아니라면 'load' 이벤트를 기다렸다가 업데이트합니다.
    if (map.isStyleLoaded()) {
      updateSources();
    } else {
      map.once("load", updateSources);
    }
  }, [activeCoordinates, activeAltCoordinates]);

  return (
    <div
      className="route-map w-full h-full"
      ref={containerRef}
      aria-hidden="true"
    />
  );
}
