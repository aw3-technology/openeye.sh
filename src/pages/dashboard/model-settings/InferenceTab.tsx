import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cpu, Zap } from "lucide-react";
import type { InferenceParams, StreamParams } from "./types";

export function InferenceTab({
  inference,
  setInference,
  stream,
  setStream,
}: {
  inference: InferenceParams;
  setInference: Dispatch<SetStateAction<InferenceParams>>;
  stream: StreamParams;
  setStream: Dispatch<SetStateAction<StreamParams>>;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-terminal-green" />
            Compute Backend
          </CardTitle>
          <CardDescription>
            Hardware and precision settings for model inference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device */}
          <div className="space-y-2">
            <Label>Device</Label>
            <Select
              value={inference.device}
              onValueChange={(v) =>
                setInference((prev) => ({ ...prev, device: v }))
              }
            >
              <SelectTrigger className="max-w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu">CPU</SelectItem>
                <SelectItem value="cuda">CUDA (GPU)</SelectItem>
                <SelectItem value="mps">
                  MPS (Apple Silicon)
                </SelectItem>
                <SelectItem value="tensorrt">TensorRT</SelectItem>
                <SelectItem value="onnx">ONNX Runtime</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hardware backend for model execution. CUDA requires an NVIDIA
              GPU; MPS requires Apple Silicon.
            </p>
          </div>

          {/* Precision */}
          <div className="space-y-2">
            <Label>Precision</Label>
            <Select
              value={inference.precision}
              onValueChange={(v) =>
                setInference((prev) => ({ ...prev, precision: v }))
              }
            >
              <SelectTrigger className="max-w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fp32">FP32 (Full)</SelectItem>
                <SelectItem value="fp16">FP16 (Half)</SelectItem>
                <SelectItem value="int8">INT8 (Quantized)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lower precision is faster and uses less memory but may
              reduce accuracy slightly.
            </p>
          </div>

          {/* Batch size */}
          <div className="space-y-2">
            <Label htmlFor="batch-size">Batch Size</Label>
            <Input
              id="batch-size"
              type="number"
              value={inference.batch_size}
              onChange={(e) =>
                setInference((prev) => ({
                  ...prev,
                  batch_size: Math.max(
                    1,
                    Math.min(32, Math.floor(Number(e.target.value) || 1)),
                  ),
                }))
              }
              min={1}
              max={32}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Number of frames to process in a single batch (1–32). Higher
              values improve throughput on GPUs.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-terminal-amber" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warmup */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Warmup on Start</Label>
              <p className="text-xs text-muted-foreground">
                Run a dummy inference pass on startup to warm the model.
              </p>
            </div>
            <Switch
              checked={inference.warmup}
              onCheckedChange={(v) =>
                setInference((prev) => ({ ...prev, warmup: v }))
              }
            />
          </div>

          {/* TensorRT optimization */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>TensorRT Optimization</Label>
              <p className="text-xs text-muted-foreground">
                Export and optimize the model with TensorRT (NVIDIA only).
              </p>
            </div>
            <Switch
              checked={inference.tensorrt}
              onCheckedChange={(v) =>
                setInference((prev) => ({ ...prev, tensorrt: v }))
              }
            />
          </div>

          {/* Stream Hz */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Stream Rate</Label>
              <span className="text-sm font-mono tabular-nums">
                {stream.hertz} Hz
              </span>
            </div>
            <Slider
              value={[stream.hertz]}
              onValueChange={([v]) =>
                setStream((prev) => ({ ...prev, hertz: v }))
              }
              min={1}
              max={60}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Target frames per second for the WebSocket camera stream.
            </p>
          </div>

          {/* Buffer frames */}
          <div className="space-y-2">
            <Label htmlFor="buffer-frames">Buffer Frames</Label>
            <Input
              id="buffer-frames"
              type="number"
              value={stream.buffer_frames}
              onChange={(e) =>
                setStream((prev) => ({
                  ...prev,
                  buffer_frames: Math.max(
                    0,
                    Math.min(30, Math.floor(Number(e.target.value) || 0)),
                  ),
                }))
              }
              min={0}
              max={30}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Number of frames to buffer before displaying (0–30). Higher
              values smooth playback but add latency.
            </p>
          </div>

          {/* Auto-reconnect */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Reconnect</Label>
              <p className="text-xs text-muted-foreground">
                Automatically reconnect WebSocket on disconnect.
              </p>
            </div>
            <Switch
              checked={stream.auto_reconnect}
              onCheckedChange={(v) =>
                setStream((prev) => ({ ...prev, auto_reconnect: v }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
