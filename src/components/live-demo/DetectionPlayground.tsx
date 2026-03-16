import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Crosshair, ImagePlus } from "lucide-react";
import { sampleImages, uploadedImageDetections } from "./detection-data";
import { detectionColorClasses } from "./constants";

export function DetectionPlayground() {
  const [selectedSample, setSelectedSample] = useState(0);
  const [showDetections, setShowDetections] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [useUpload, setUseUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runDetection = useCallback(() => {
    setShowDetections(false);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowDetections(true);
    }, 800 + Math.random() * 400);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setUseUpload(true);
    setShowDetections(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const sample = useUpload
    ? { name: "Uploaded", image: uploadedImage!, objects: uploadedImageDetections }
    : sampleImages[selectedSample];

  return (
    <div className="space-y-6">
      {/* Sample selector + upload */}
      <div className="flex flex-wrap gap-3">
        {sampleImages.map((s, i) => (
          <button
            key={s.name}
            onClick={() => {
              setSelectedSample(i);
              setUseUpload(false);
              setShowDetections(false);
            }}
            className={`px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
              !useUpload && i === selectedSample
                ? "bg-primary/10 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
            useUpload
              ? "bg-primary/10 border-primary text-primary"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Detection viewport */}
        <div className="lg:col-span-2">
          <div
            className={`relative aspect-video bg-card border rounded-xl overflow-hidden transition-colors ${
              isDragOver ? "border-primary border-2 bg-primary/5" : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Scene image */}
            {(useUpload && uploadedImage) || !useUpload ? (
              <img
                src={sample.image}
                alt={`${sample.name} scene`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}

            {/* Drop zone overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3 font-mono text-sm text-primary">
                  <ImagePlus className="w-8 h-8" />
                  Drop image here
                </div>
              </div>
            )}

            {/* Upload placeholder when no image yet */}
            {useUpload && !uploadedImage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-10 h-10" />
                  <span className="font-mono text-sm">Click or drag an image here</span>
                </button>
              </div>
            )}

            {/* Detection boxes */}
            <AnimatePresence>
              {showDetections &&
                sample.objects.map((obj, i) => {
                  const cls = detectionColorClasses[obj.color];
                  return (
                    <motion.div
                      key={`${useUpload ? "upload" : selectedSample}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.2 }}
                      className="absolute"
                      style={{
                        left: `${obj.bbox.x * 100}%`,
                        top: `${obj.bbox.y * 100}%`,
                        width: `${obj.bbox.w * 100}%`,
                        height: `${obj.bbox.h * 100}%`,
                      }}
                    >
                      <div className={`w-full h-full border-2 ${cls.border} ${cls.bg}`} />
                      <span className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 ${cls.label} text-primary-foreground whitespace-nowrap`}>
                        {obj.label} [{(obj.confidence * 100).toFixed(1)}%]
                      </span>
                      <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${cls.border}`} />
                      <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${cls.border}`} />
                      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${cls.border}`} />
                      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${cls.border}`} />
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3 font-mono text-sm text-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Running inference...
                </div>
              </div>
            )}
          </div>

          {/* Run button */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={runDetection}
              disabled={isProcessing || (useUpload && !uploadedImage)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-mono text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              <Crosshair className="w-4 h-4" />
              Run Detection
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Simulated YOLOv8 inference — no server required
            </span>
          </div>
        </div>

        {/* Results panel */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Detection Results</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-2 max-h-[400px] overflow-y-auto">
            {showDetections ? (
              <>
                <div className="text-oe-green mb-3">
                  {"\u2713"} Detected {sample.objects.length} objects in {(18 + Math.random() * 12).toFixed(0)}ms
                </div>
                {sample.objects.map((obj, i) => {
                  const cls = detectionColorClasses[obj.color];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`p-2 rounded-lg border ${cls.resultBg} ${cls.resultBorder}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`${cls.text} font-medium`}>{obj.label}</span>
                        <span className="text-muted-foreground tabular-nums">{(obj.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-muted-foreground mt-1 tabular-nums">
                        bbox: [{(obj.bbox.x * 1280).toFixed(0)}, {(obj.bbox.y * 720).toFixed(0)}, {((obj.bbox.x + obj.bbox.w) * 1280).toFixed(0)}, {((obj.bbox.y + obj.bbox.h) * 720).toFixed(0)}]
                      </div>
                    </motion.div>
                  );
                })}
                <div className="pt-3 border-t border-border mt-3 text-muted-foreground">
                  <div>Model: yolov8-xl</div>
                  <div>Resolution: 1280x720</div>
                  <div>Backend: CUDA (simulated)</div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                Click "Run Detection" to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
