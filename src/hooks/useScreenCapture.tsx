import { useState, useCallback, useRef, useEffect } from "react";

export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // autoplay blocked
        }
      }

      // Handle user stopping via browser UI
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setIsCapturing(false);
        streamRef.current = null;
      });

      setIsCapturing(true);
    } catch (err) {
      const msg =
        err instanceof DOMException ? err.message : "Screen capture failed";
      throw new Error(msg);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isCapturing,
    videoRef,
    stream: streamRef.current,
    startCapture,
    stopCapture,
  };
}
