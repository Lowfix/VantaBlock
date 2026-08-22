import { cn } from "../../lib/cn";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;

function buildPoints(data: number[], max: number) {
  const usableHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? CHART_WIDTH / (data.length - 1) : CHART_WIDTH;
  return data.map((value, i) => {
    const x = i * step;
    const y = PAD_TOP + usableHeight * (1 - Math.min(1, value / max));
    return [x, y] as const;
  });
}

function toPath(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

interface AreaChartProps {
  data: number[];
  max: number;
  color?: string;
  yLabels: string[];
  xLabels: string[];
  className?: string;
}

export function AreaChart({ data, max, color = "#8257ff", yLabels, xLabels, className }: AreaChartProps) {
  const points = buildPoints(data, max);
  const linePath = toPath(points);
  const areaPath = `${linePath} L${CHART_WIDTH},${CHART_HEIGHT - PAD_BOTTOM} L0,${CHART_HEIGHT - PAD_BOTTOM} Z`;
  const gradientId = `area-gradient-${color.replace("#", "")}`;

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="flex shrink-0 flex-col justify-between py-1 text-right text-[10.5px] text-text-lo" style={{ height: CHART_HEIGHT - PAD_BOTTOM }}>
        {yLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" preserveAspectRatio="none" style={{ height: CHART_HEIGHT }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={CHART_WIDTH}
              y1={PAD_TOP + (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
              y2={PAD_TOP + (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
              stroke="#26262f"
              strokeWidth="1"
            />
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div className="mt-1 flex justify-between text-[10.5px] text-text-lo">
          {xLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Series {
  label: string;
  color: string;
  data: number[];
}

interface MultiLineChartProps {
  series: Series[];
  max: number;
  yLabels: string[];
  xLabels: string[];
  className?: string;
}

export function MultiLineChart({ series, max, yLabels, xLabels, className }: MultiLineChartProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <div className="flex shrink-0 flex-col justify-between py-1 text-right text-[10.5px] text-text-lo" style={{ height: CHART_HEIGHT - PAD_BOTTOM }}>
        {yLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" preserveAspectRatio="none" style={{ height: CHART_HEIGHT }}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={CHART_WIDTH}
              y1={PAD_TOP + (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
              y2={PAD_TOP + (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
              stroke="#26262f"
              strokeWidth="1"
            />
          ))}
          {series.map((s) => (
            <path
              key={s.label}
              d={toPath(buildPoints(s.data, max))}
              fill="none"
              stroke={s.color}
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-[10.5px] text-text-lo">
          {xLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
