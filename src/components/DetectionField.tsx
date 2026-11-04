/**
 * Hero background: faint bounding boxes that lock onto the page, hold, and
 * release, like detections on a live feed. Purely decorative.
 */

interface Detection {
  label: string;
  /** Position and size as percentages of the field. */
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  hazard?: boolean;
}

// Kept to the outer columns so boxes never sit behind the hero copy.
const detections: Detection[] = [
  { label: "person 0.97", x: 3, y: 12, w: 11, h: 28, delay: 0 },
  { label: "robot_arm 0.93", x: 84, y: 8, w: 13, h: 20, delay: 1.5 },
  { label: "cup 0.91", x: 9, y: 62, w: 6, h: 8, delay: 3 },
  { label: "hand 0.94 · in zone", x: 86, y: 48, w: 7, h: 10, delay: 4.5, hazard: true },
  { label: "box 0.88", x: 4, y: 45, w: 8, h: 10, delay: 6 },
  { label: "laptop 0.95", x: 82, y: 68, w: 12, h: 11, delay: 7.5 },
  { label: "chair 0.86", x: 2, y: 78, w: 9, h: 13, delay: 9 },
  { label: "book 0.89", x: 88, y: 32, w: 6, h: 8, delay: 10.5 },
];

export function DetectionField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,transparent_30%,black_75%)]"
    >
      {detections.map((d) => (
        <div
          key={d.label}
          className="oe-detect hidden sm:block"
          data-hazard={d.hazard ? "" : undefined}
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.w}%`,
            height: `${d.h}%`,
            ["--oe-delay" as string]: `${d.delay}s`,
          }}
        >
          <i />
          <i />
          <i />
          <i />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
