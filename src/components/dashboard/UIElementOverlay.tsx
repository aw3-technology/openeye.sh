import type { UIElement } from "@/types/openeye";

const TYPE_COLORS: Record<string, string> = {
  button: "#22c55e",
  input: "#3b82f6",
  link: "#a855f7",
  menu: "#f59e0b",
  menu_item: "#f59e0b",
  tab: "#06b6d4",
  checkbox: "#ec4899",
  radio: "#ec4899",
  dropdown: "#f59e0b",
  dialog: "#ef4444",
  text: "#6b7280",
  image: "#8b5cf6",
  other: "#6b7280",
};

interface UIElementOverlayProps {
  elements: UIElement[];
  containerWidth: number;
  containerHeight: number;
}

export function UIElementOverlay({
  elements,
  containerWidth,
  containerHeight,
}: UIElementOverlayProps) {
  if (!containerWidth || !containerHeight || elements.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
    >
      {elements.map((el, i) => {
        const x = el.bbox_pct.x * containerWidth;
        const y = el.bbox_pct.y * containerHeight;
        const w = el.bbox_pct.w * containerWidth;
        const h = el.bbox_pct.h * containerHeight;
        const color = TYPE_COLORS[el.type] || TYPE_COLORS.other;

        return (
          <g key={i}>
            {/* Bounding box */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.8}
              rx={2}
            />
            {/* Label background */}
            <rect
              x={x}
              y={Math.max(0, y - 16)}
              width={Math.min(
                el.text ? el.text.length * 6 + 40 : 60,
                containerWidth - x,
              )}
              height={14}
              fill={color}
              fillOpacity={0.85}
              rx={2}
            />
            {/* Label text */}
            <text
              x={x + 3}
              y={Math.max(11, y - 4)}
              fill="white"
              fontSize={9}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {el.type}
              {el.text ? `: ${el.text.slice(0, 20)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
