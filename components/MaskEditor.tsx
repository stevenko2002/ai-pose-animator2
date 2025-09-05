import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MaskEditorProps {
  src: string;
  onClose: () => void;
  onMaskComplete: (maskDataUrl: string) => void;
}

const MaskEditor: React.FC<MaskEditorProps> = ({ src, onClose, onMaskComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [isErasing, setIsErasing] = useState(false);

  const getCanvasContext = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }), []);

  const setCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = getCanvasContext();
    if (canvas && image && image.naturalWidth > 0 && ctx) {
      const container = canvas.parentElement;
      if (!container) return;
      
      const maxWidth = container.clientWidth;
      const maxHeight = window.innerHeight * 0.6;
      const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      
      canvas.width = image.naturalWidth * ratio;
      canvas.height = image.naturalHeight * ratio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [getCanvasContext]);

  useEffect(() => {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      imageRef.current = image;
      setCanvasSize();
    };
  }, [src, setCanvasSize]);

  useEffect(() => {
    window.addEventListener('resize', setCanvasSize);
    return () => window.removeEventListener('resize', setCanvasSize);
  }, [setCanvasSize]);
  
  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const ctx = getCanvasContext();
    if (!ctx) return;
    const { x, y } = getCoordinates(event);
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    event.preventDefault();
    const ctx = getCanvasContext();
    if (!ctx) return;

    ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { x, y } = getCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };
  
  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = image.naturalWidth;
    finalCanvas.height = image.naturalHeight;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;

    finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
    
    const imageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      const color = alpha > 0 ? 255 : 0;
      data[i] = color;
      data[i + 1] = color;
      data[i + 2] = color;
      data[i + 3] = 255;
    }
    finalCtx.putImageData(imageData, 0, 0);

    onMaskComplete(finalCanvas.toDataURL('image/png'));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-slate-900 p-6 rounded-lg shadow-2xl flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">建立遮罩</h2>
        <p className="text-slate-400 mb-4 text-center">在您希望 AI 編輯的區域上塗抹。使用橡皮擦修正錯誤。</p>
        
        <div className="relative w-full h-auto max-h-[60vh] flex justify-center items-center touch-none">
            <img src={src} alt="Background" className="max-w-full max-h-full object-contain pointer-events-none" />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-4">
                <label htmlFor="brushSize" className="text-sm font-medium text-slate-300">筆刷大小：</label>
                <input
                    id="brushSize"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-36"
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsErasing(false)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${!isErasing ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                    筆刷
                </button>
                <button
                    onClick={() => setIsErasing(true)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${isErasing ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                    橡皮擦
                </button>
            </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button onClick={onClose} className="px-6 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button onClick={handleConfirm} className="px-6 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
            確認遮罩
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaskEditor;