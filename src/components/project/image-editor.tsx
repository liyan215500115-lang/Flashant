"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RotateCw, Sun, Contrast, Download, X, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ImageEditorProps {
  imageUrl: string;
  fileName: string;
  onSave: (newUrl: string, blob: Blob) => void;
  onClose: () => void;
}

export function ImageEditor({ imageUrl, fileName, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<"crop" | "rotate" | "brightness" | "contrast" | "text" | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(32);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; setLoading(false); redraw(); };
    img.onerror = (e) => { console.error("Image load failed", e); setLoading(false); };
    // Add timestamp to bypass cache/CORS issues
    img.src = imageUrl.startsWith("http") ? imageUrl : imageUrl + (imageUrl.includes("?") ? "&" : "?") + "_t=" + Date.now();
  }, [imageUrl]);

  const redraw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.save();
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } else {
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
    ctx.filter = "none";
    if (textInput.trim()) {
      ctx.font = `600 ${textSize}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.fillText(textInput, img.width / 2, img.height * 0.85);
      ctx.textAlign = "left";
    }
  }, [brightness, contrast, rotation, textInput, textColor, textSize]);

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      onSave(url, blob);
    }, "image/png", 1.0);
  }

  if (loading) return <div className="text-center py-12 text-zinc-400">加载中...</div>;
  if (!imgRef.current) return <div className="text-center py-12 text-zinc-400">图片加载失败，请重试</div>;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">编辑图片</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onClose} className="gap-1 cursor-pointer"><X size={14} /> 取消</Button>
            <Button size="sm" onClick={handleSave} className="gap-1 cursor-pointer bg-brand-900 hover:bg-brand-800 text-white"><Download size={14} /> 保存</Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 p-4">
          <canvas ref={canvasRef} className="max-w-full max-h-[60vh] rounded-lg shadow-md" />
        </div>

        {/* Tools */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button onClick={() => setTool(tool === "rotate" ? null : "rotate")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tool === "rotate" ? "bg-brand-100 text-brand-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}>
              <RotateCw size={13} className="inline mr-1" />旋转 90°
            </button>
            <button onClick={() => setTool(tool === "brightness" ? null : "brightness")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tool === "brightness" ? "bg-brand-100 text-brand-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}>
              <Sun size={13} className="inline mr-1" />亮度
            </button>
            <button onClick={() => setTool(tool === "contrast" ? null : "contrast")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tool === "contrast" ? "bg-brand-100 text-brand-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}>
              <Contrast size={13} className="inline mr-1" />对比度
            </button>
            <button onClick={() => setTool(tool === "text" ? null : "text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tool === "text" ? "bg-brand-100 text-brand-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}>
              <Type size={13} className="inline mr-1" />文字
            </button>
            <button onClick={() => { setTool(null); setRotation(0); setBrightness(100); setContrast(100); setTextInput(""); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <X size={13} className="inline mr-1" />重置
            </button>
          </div>
          {tool === "brightness" && (
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-zinc-500 w-10">亮度</span>
              <Slider value={[brightness]} onValueChange={(v) => setBrightness(Array.isArray(v) ? v[0] : v)} min={50} max={200} step={1} className="flex-1" />
              <span className="text-xs text-zinc-500 w-8 text-right">{brightness}%</span>
            </div>
          )}
          {tool === "contrast" && (
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-zinc-500 w-10">对比度</span>
              <Slider value={[contrast]} onValueChange={(v) => setContrast(Array.isArray(v) ? v[0] : v)} min={50} max={200} step={1} className="flex-1" />
              <span className="text-xs text-zinc-500 w-8 text-right">{contrast}%</span>
            </div>
          )}
          {tool === "rotate" && (
            <div className="flex gap-2 mb-2">
              {[90, 180, 270].map((deg) => (
                <button key={deg} type="button" onClick={() => setRotation(deg)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${rotation === deg ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                  {deg}°
                </button>
              ))}
            </div>
          )}
          {tool === "text" && (
            <div className="flex flex-col gap-2 mb-2">
              <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                placeholder="输入要显示的文字..."
                className="w-full h-9 rounded-lg border border-zinc-200 px-3 text-xs focus:border-brand-500 focus:outline-none" />
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">大小</span>
                <Slider value={[textSize]} onValueChange={(v) => setTextSize(Array.isArray(v) ? v[0] : v)} min={12} max={72} step={1} className="flex-1" />
                <span className="text-xs text-zinc-500 w-8 text-right">{textSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">颜色</span>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                <div className="flex gap-1">
                  {["#ffffff","#000000","#2563EB","#DC2626","#F59E0B","#10B981"].map((c) => (
                    <button key={c} type="button" onClick={() => setTextColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-colors ${textColor === c ? "border-brand-500" : "border-zinc-200"}`} style={{background:c}} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
