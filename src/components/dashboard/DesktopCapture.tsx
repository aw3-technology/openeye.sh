import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, MonitorOff } from "lucide-react";

interface DesktopCaptureProps {
  isCapturing: boolean;
  onStart: () => void;
  onStop: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  children?: React.ReactNode; // overlay content
}

export function DesktopCapture({
  isCapturing,
  onStart,
  onStop,
  videoRef,
  children,
}: DesktopCaptureProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-border bg-black">
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full aspect-video object-contain bg-black"
      />

      {/* Overlays */}
      {children}

      {/* HUD overlay */}
      {isCapturing && (
        <div className="absolute top-3 left-3 font-mono text-[10px] text-terminal-green/80 bg-background/70 backdrop-blur px-2 py-1 rounded">
          <div className="flex items-center gap-1.5">
            <Monitor className="h-3 w-3" />
            DESKTOP VISION
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isCapturing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
          <Monitor className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Share your screen to start desktop vision analysis
          </p>
          <Button
            onClick={onStart}
            className="gap-2 bg-terminal-green hover:bg-terminal-green/80 text-primary-foreground"
          >
            <Monitor className="h-4 w-4" />
            Start Screen Share
          </Button>
        </div>
      )}

      {/* Recording indicator */}
      {isCapturing && (
        <div className="absolute top-3 right-3">
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-red-500/50 text-red-400 animate-pulse"
          >
            REC
          </Badge>
        </div>
      )}
    </div>
  );
}
