"use client";

import type { ReadingRecord } from "@/lib/zone-types";

interface MoistureSparklineProps {
  readings: ReadingRecord[];
  minMoisture: number;
  maxMoisture: number;
}

export function MoistureSparkline({
  readings,
  minMoisture,
  maxMoisture,
}: MoistureSparklineProps) {
  const width = 260;
  const height = 64;
  const padX = 4;
  const padY = 6;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const yFor = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return padY + plotH - (clamped / 100) * plotH;
  };

  const yMaxLine = yFor(maxMoisture);
  const yMinLine = yFor(minMoisture);

  const points = readings.map((r, index) => {
    const x =
      readings.length <= 1
        ? padX + plotW / 2
        : padX + (index / (readings.length - 1)) * plotW;
    const y = yFor(r.moisture);
    return { x, y, reading: r };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200/80 px-2.5 py-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span>Tendencia de humedad</span>
        <span>
          {readings.length > 0
            ? `${readings.length} lectura${readings.length === 1 ? "" : "s"}`
            : "Sin lecturas"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-16 overflow-visible"
        role="img"
        aria-label="Gráfico de tendencia de humedad del suelo"
      >
        {/* Banda óptima */}
        <rect
          x={padX}
          y={yMaxLine}
          width={plotW}
          height={Math.max(2, yMinLine - yMaxLine)}
          fill="#dcfce7"
          opacity={0.75}
          rx={2}
        />

        {/* Líneas umbral */}
        <line
          x1={padX}
          y1={yMaxLine}
          x2={width - padX}
          y2={yMaxLine}
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.55}
        />
        <line
          x1={padX}
          y1={yMinLine}
          x2={width - padX}
          y2={yMinLine}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.65}
        />

        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="#15803d"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}

        {points.map((p) => (
          <circle
            key={p.reading.id}
            cx={p.x}
            cy={p.y}
            r={p === lastPoint ? 3.5 : 2}
            fill={
              p.reading.status === "SOBRE_RIEGO"
                ? "#dc2626"
                : p.reading.status === "INSUFICIENTE"
                  ? "#d97706"
                  : "#15803d"
            }
          />
        ))}
      </svg>
    </div>
  );
}

