"use client";

import { useMemo } from "react";

/**
 * Donut chart (CSS conic-gradient, žádné JS knihovny).
 */
export function DonutChart({
  segments,
  size = 120,
  thickness = 18,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm"
      >
        Žádná data
      </div>
    );
  }
  let cur = 0;
  const stops: string[] = [];
  for (const s of segments) {
    const start = (cur / total) * 360;
    cur += s.value;
    const end = (cur / total) * 360;
    stops.push(`${s.color} ${start}deg ${end}deg`);
  }
  const gradient = `conic-gradient(${stops.join(", ")})`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="rounded-full"
        style={{ width: size, height: size, background: gradient }}
      />
      <div
        className="absolute bg-white rounded-full flex items-center justify-center"
        style={{
          top: thickness,
          left: thickness,
          width: size - thickness * 2,
          height: size - thickness * 2,
        }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold">{total}</div>
          <div className="text-xs text-slate-500">celkem</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sparkline — malý SVG graf trendu.
 */
export function Sparkline({
  data,
  color = "#2563eb",
  height = 40,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const width = 120;
  const max = Math.max(...data, 1);

  const { points, area } = useMemo(() => {
    if (data.length === 0) return { points: "", area: "" };
    const step = width / Math.max(data.length - 1, 1);
    const pts = data.map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    });
    const pointsStr = pts.join(" ");
    const areaStr = `0,${height} ${pointsStr} ${width},${height}`;
    return { points: pointsStr, area: areaStr };
  }, [data, height, max]);

  if (data.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <polygon
          points={area}
          fill={color}
          opacity={0.15}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - (data[data.length - 1] / max) * (height - 4) - 2}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

/**
 * Mini progress bar pro %
 */
export function ProgressBar({
  percent,
  color = "bg-brand-500",
}: {
  percent: number;
  color?: string;
}) {
  const v = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
