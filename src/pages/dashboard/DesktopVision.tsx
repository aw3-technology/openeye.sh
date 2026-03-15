import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Monitor, Square, Search } from "lucide-react";
import { toast } from "sonner";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useDesktopStream } from "@/hooks/useDesktopStream";
import { DesktopCapture } from "@/components/dashboard/DesktopCapture";
import { UIElementOverlay } from "@/components/dashboard/UIElementOverlay";
import { DesktopAnalysis } from "@/components/dashboard/DesktopAnalysis";

export default function DesktopVision() {
  const { isCapturing, videoRef, startCapture, stopCapture } =
    useScreenCapture();
  const { isStreaming, latestResult, fps, frameCount, startStream, stopStream, findElement } =
    useDesktopStream();
  const [searchQuery, setSearchQuery] = useState("");
  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStart = useCallback(async () => {
    try {
      await startCapture();
      // Wait for video to be ready, then start streaming
      const checkVideo = () => {
        if (
          videoRef.current &&
          videoRef.current.videoWidth > 0
        ) {
          startStream(videoRef.current);
          setVideoDimensions({
            width: videoRef.current.clientWidth,
            height: videoRef.current.clientHeight,
          });
        } else {
          setTimeout(checkVideo, 200);
        }
      };
      setTimeout(checkVideo, 500);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start screen capture",
      );
    }
  }, [startCapture, startStream, videoRef]);

  const handleStop = useCallback(() => {
    stopStream();
    stopCapture();
  }, [stopStream, stopCapture]);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      findElement(searchQuery.trim());
    }
  }, [searchQuery, findElement]);

  // Update video dimensions on resize
  const handleVideoResize = useCallback(() => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.clientWidth,
        height: videoRef.current.clientHeight,
      });
    }
  }, [videoRef]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-terminal-green" />
            Desktop Vision
          </h1>
          <Badge
            variant="outline"
            className="text-[10px] font-mono uppercase tracking-wider border-terminal-green/30 text-terminal-green"
          >
            Beta
          </Badge>
        </div>
        {isCapturing && (
          <Button
            onClick={handleStop}
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        )}
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-4">
        Screen capture with VLM-powered UI understanding. YOLO detection runs
        every frame, VLM analysis runs every 3 seconds to identify UI elements,
        text, and layout.
      </p>

      {/* Find Element bar */}
      {isStreaming && (
        <div className="flex gap-2">
          <Input
            placeholder='Find element... (e.g. "submit button", "search bar")'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-mono text-sm"
          />
          <Button
            onClick={handleSearch}
            variant="outline"
            size="icon"
            disabled={!searchQuery.trim()}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Screen preview with overlays */}
        <div className="lg:col-span-2" ref={containerRef}>
          <DesktopCapture
            isCapturing={isCapturing}
            onStart={handleStart}
            onStop={handleStop}
            videoRef={videoRef}
          >
            {/* UI Element Overlays */}
            {latestResult && latestResult.ui_elements.length > 0 && (
              <UIElementOverlay
                elements={latestResult.ui_elements}
                containerWidth={videoDimensions.width}
                containerHeight={videoDimensions.height}
              />
            )}
          </DesktopCapture>

          {/* Find result feedback */}
          {latestResult?.type === "desktop_find" && (
            <div className="mt-2 p-2 rounded border border-border bg-muted/30">
              <p className="text-xs font-mono">
                {latestResult.found ? (
                  <span className="text-terminal-green">
                    Found: {latestResult.ui_elements?.[0]?.text || latestResult.ui_elements?.[0]?.type}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    No match found for &quot;{latestResult.query}&quot;
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Right: Analysis panel */}
        <div className="lg:col-span-1">
          <DesktopAnalysis
            result={latestResult}
            fps={fps}
            frameCount={frameCount}
          />
        </div>
      </div>
    </div>
  );
}
