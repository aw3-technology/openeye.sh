import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Terminal, ExternalLink, ChevronRight } from "lucide-react";
import { adapterSteps } from "@/data/modelsData";

export function AdaptersTab() {
  return (
    <div className="space-y-4">
      {/* Steps */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {adapterSteps.map((step, i) => (
          <Card key={step.step}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-semibold text-terminal-green/40">
                  {step.step}
                </span>
                {i < adapterSteps.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto hidden lg:block" />
                )}
              </div>
              <div className="text-sm font-medium">{step.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Code example */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Example Adapter Implementation
          </CardTitle>
          <CardDescription>
            Every model implements a shared interface — load, predict,
            postprocess. Adding a new model means writing one file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-secondary overflow-hidden">
            <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/30">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <span className="font-mono text-[10px] text-muted-foreground ml-2">
                adapters/yolo_adapter.py
              </span>
            </div>
            <pre className="px-5 py-4 font-mono text-xs text-oe-green overflow-x-auto leading-relaxed">
              <code>{`class YOLOAdapter(ModelAdapter):
    """Drop-in adapter for any YOLO model."""

    def load(self, weights: str = "yolo26n.pt"):
        self.model = YOLO(weights)

    def predict(self, frame: np.ndarray) -> list[Detection]:
        results = self.model(frame, conf=self.conf)
        return self.postprocess(results)

# Register — one line, done.
registry.register("yolo26", YOLOAdapter)`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Interface contract */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            ModelAdapter Interface
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-secondary overflow-hidden">
            <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/30">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <span className="font-mono text-[10px] text-muted-foreground ml-2">
                adapters/base.py
              </span>
            </div>
            <pre className="px-5 py-4 font-mono text-xs text-oe-green overflow-x-auto leading-relaxed">
              <code>{`class ModelAdapter(ABC):
    """Base interface that every vision model must implement."""

    @abstractmethod
    def load(self, weights: str, device: str = "cpu") -> None:
        """Load model weights and prepare for inference."""

    @abstractmethod
    def predict(self, frame: np.ndarray, **kwargs) -> list[Detection]:
        """Run inference on a single frame."""

    def postprocess(self, raw_output) -> list[Detection]:
        """Convert raw model output into Detection objects."""
        ...

    def warmup(self, input_shape: tuple[int, ...]) -> None:
        """Optional warmup pass with dummy data."""
        self.predict(np.zeros(input_shape, dtype=np.uint8))`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
