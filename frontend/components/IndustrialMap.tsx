import React from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const geoUrl = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

interface MapProps {
  onFactoryClick: (factoryName: string) => void;
}

type GeographyItem = {
  rsmKey: string;
  [key: string]: unknown;
};

const markers = [
  { name: "上海研发中心", coordinates: [121.47, 31.23] },
  { name: "山东管道工厂", coordinates: [117.00, 36.65] },
  { name: "广东制造基地", coordinates: [113.26, 23.12] },
];

export default function IndustrialMap({ onFactoryClick }: MapProps) {
  return (
    <div className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-4 overflow-hidden">
      <h4 className="text-sm font-bold text-neutral-400 mb-4">全国产能布局</h4>
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 500, center: [105, 35] }}>
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: GeographyItem[] }) =>
            geographies.map((geo) => (
              <Geography key={geo.rsmKey} geography={geo} fill="#171717" stroke="#404040" />
            ))
          }
        </Geographies>
        {markers.map(({ name, coordinates }) => (
          <Marker 
            key={name} 
            coordinates={coordinates as [number, number]} 
            onClick={() => onFactoryClick(name)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <circle r={4} fill="#dc2626" />
            <circle r={8} fill="#dc2626" opacity={0.3} className="animate-ping" />
            <text textAnchor="middle" y={-15} className="text-[10px] fill-neutral-400 font-mono">{name}</text>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
