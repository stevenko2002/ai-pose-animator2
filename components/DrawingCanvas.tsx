import React, { useRef, useEffect, useState, useCallback } from 'react';

const generateRandomString = () => Math.random().toString(36).substring(2, 10);

interface DrawingCanvasProps {
  onCanvasUpdate: (dataUrl: string | null) => void;
  clearTrigger?: number;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onCanvasUpdate, clearTrigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setContext(ctx);
      }
    }
  }, []);
  
  const clearCanvas = useCallback(() => {
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onCanvasUpdate(null);
      setHasContent(false);
    }
  }, [context, onCanvasUpdate]);

  useEffect(() => {
    if (clearTrigger !== undefined) {
        clearCanvas();
    }
  }, [clearTrigger, clearCanvas]);

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = () => {
    if (canvasRef.current) {
        downloadImage(canvasRef.current.toDataURL('image/png'), `pose_drawing_${generateRandomString()}.png`);
    }
  };

  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in event) {
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top
      };
    }
    return { offsetX: event.nativeEvent.offsetX, offsetY: event.nativeEvent.offsetY };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!context) return;
    event.preventDefault();
    const { offsetX, offsetY } = getCoordinates(event);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context) return;
    event.preventDefault();
    const { offsetX, offsetY } = getCoordinates(event);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context || !canvasRef.current) return;
    context.closePath();
    setIsDrawing(false);
    onCanvasUpdate(canvasRef.current.toDataURL('image/png'));
    setHasContent(true);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">2. Draw a Pose</h3>
      <canvas
        ref={canvasRef}
        width={350}
        height={500}
        className="bg-slate-900 rounded-md cursor-crosshair border-2 border-dashed border-slate-600 touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <button
          onClick={clearCanvas}
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Clear Canvas
        </button>
        <button
          onClick={handleSave}
          disabled={!hasContent}
          className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Pose
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;