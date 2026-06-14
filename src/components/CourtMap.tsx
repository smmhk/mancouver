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
            { elementType: "geometry", stylers: [{ color: "#f5f2e6" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#faf8f1" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#5b6b62" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e7e2d0" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbe7d6" }] },
            { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef0e3" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d8e6c8" }] },
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
          fillColor: isSel ? "#1f4d2a" : "#ffffff",
          fillOpacity: 1,
          strokeColor: isSel ? "#ffffff" : "#1f4d2a",
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
