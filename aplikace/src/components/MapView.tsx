"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapPlace {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  count: number;
  color: string;
  years: string;
  hypothesis: boolean;
  dim?: boolean; // mimo linii přihlášeného
}

export function MapView({ places }: { places: MapPlace[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      const max = Math.max(1, ...places.map((p) => p.count));
      for (const p of places) {
        L.circleMarker([p.lat, p.lon], {
          radius: 6 + 14 * Math.sqrt(p.count / max),
          color: "#fff",
          weight: 1.5,
          fillColor: p.color,
          fillOpacity: p.dim ? 0.25 : p.hypothesis ? 0.4 : 0.85,
          opacity: p.dim ? 0.5 : 1,
          dashArray: p.hypothesis ? "3 3" : undefined,
        })
          .bindPopup(
            `<strong style="font-size:15px">${p.name}</strong><br>${p.count} osob${p.years ? ` · ${p.years}` : ""}<br><a href="/misto/${p.slug}/">Kdo tu žil →</a>`,
          )
          .bindTooltip(p.name)
          .addTo(map);
      }
      if (places.length) map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lon])), { padding: [40, 40], maxZoom: 12 });
      else map.setView([49.8, 15.5], 7);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [places]);
  return <div ref={el} className="h-full w-full" />;
}
