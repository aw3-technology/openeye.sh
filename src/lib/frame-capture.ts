/** Shared video-frame capture and FPS measurement utilities. */

export interface CaptureOptions {
  /** JPEG quality 0-1 (default 0.7) */
  quality?: number;
  /** Max width in px — frame is scaled down proportionally if wider */
  maxWidth?: number;
}

/**
 * Draw a video element onto a canvas and return the base64-encoded JPEG
 * (without the data-URL prefix). Returns `null` if the video has no frames.
 */
export function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  opts: CaptureOptions = {},
): string | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;

  const { quality = 0.7, maxWidth } = opts;
  const scale = maxWidth ? Math.min(1, maxWidth / video.videoWidth) : 1;

  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

/**
 * Sliding-window FPS counter.
 * Call `tick()` on each frame; it returns the current FPS estimate.
 */
export class FpsCounter {
  private buffer: number[] = [];
  private readonly size: number;

  constructor(bufferSize = 30) {
    this.size = bufferSize;
  }

  /** Record a frame timestamp and return the current FPS. */
  tick(now = performance.now()): number {
    this.buffer.push(now);
    if (this.buffer.length > this.size) this.buffer.shift();
    const elapsed =
      this.buffer.length > 1
        ? (now - this.buffer[0]) / 1000
        : 1;
    return Math.round(this.buffer.length / elapsed);
  }

  /** Current FPS without recording a new frame. */
  get fps(): number {
    if (this.buffer.length < 2) return 0;
    const elapsed = (this.buffer[this.buffer.length - 1] - this.buffer[0]) / 1000;
    return elapsed > 0 ? Math.round(this.buffer.length / elapsed) : 0;
  }

  reset(): void {
    this.buffer = [];
  }
}
