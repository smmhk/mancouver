import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
    __initTennisMap?: () => void;
    __mapsLoading?: Promise<void>;
  }
}

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__mapsLoading) return window.__mapsLoading;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  window.__mapsLoading = new Promise((resolve) => {
    window.__initTennisMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initTennisMap&channel=${channel ?? ""}`;
    s.async = true;
    document.head.appendChild(s);
  });
  return window.__mapsLoading;
}

export interface Court {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

export function CourtMap({
  courts,
  selectedId,
  onSelect,
  height = 260,
}: {
  courts: Court[];
  selectedId: string | null;
  onSelect: (c: Court) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        mapRef.current = new window.google.maps.Map(ref.current, {
          center: { lat: 49.2606, lng: -123.114 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0a2452" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#041027" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#a8c2ea" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#123268" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1c3f7d" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#03102b" }] },
            { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0b264f" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#123a6b" }] },
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          ],

        });
      })
      .catch(() => setError("Map failed to load"));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    // Clear stale markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    courts.forEach((c) => {
      const isSel = c.id === selectedId;
      const marker = new window.google.maps.Marker({
        position: { lat: c.latitude, lng: c.longitude },
        map: mapRef.current,
        title: c.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isSel ? 11 : 7,
          fillColor: isSel ? "#ffd400" : "#0b3d91",
          fillOpacity: 1,
          strokeColor: isSel ? "#041027" : "#ffffff",
          strokeWeight: 2.5,
        },

      });
      marker.addListener("click", () => onSelect(c));
      markersRef.current.set(c.id, marker);
    });
  }, [courts, selectedId, onSelect]);

  return (
    <div
      ref={ref}
      style={{ height }}
      className="w-full rounded-2xl overflow-hidden border border-border bg-card"
    >
      {error && <div className="p-4 text-xs text-muted-foreground">{error}</div>}
    </div>
  );
}
