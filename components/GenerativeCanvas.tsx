import React, { useState, useRef, useEffect, useCallback } from 'react';

interface GenerativeCanvasProps {
  src: string;
  onClose: () => void;
  onConfirm: (editData: { image: string; mask: string; aspectRatio: string; }) => void;
}

const MAX_SIZE = 1400; // Max canvas dimension

const GenerativeCanvas: React.FC<GenerativeCanvasProps> = ({ src, onClose, onConfirm }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);

    const [naturalImageSize, setNaturalImageSize] = useState({ width: 0, height: 0 });
    const [displayImageSize, setDisplayImageSize] = useState({ width: 0, height: 0 });
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
    
    // Editing tools state
    const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);

    // Dragging canvas handles state
    const [isDraggingHandle, setIsDraggingHandle] = useState(false);
    const [dragHandle, setDragHandle] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const setupCanvases = useCallback(() => {
        const container = containerRef.current;
        const img = imageRef.current;
        if (!container || !img || !img.naturalWidth) return;

        const containerW = container.clientWidth - 40; // padding
        const containerH = container.clientHeight - 40; // padding
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;

        let initialW, initialH;
        if (containerW / containerH > imgAspectRatio) {
            initialH = Math.min(img.naturalHeight, containerH);
            initialW = initialH * imgAspectRatio;
        } else {
            initialW = Math.min(img.naturalWidth, containerW);
            initialH = initialW / imgAspectRatio;
        }

        setNaturalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        setDisplayImageSize({ width: initialW, height: initialH });
        setCanvasSize({ width: initialW, height: initialH });
    }, []);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setupCanvases();
        };
        img.src = src;
        window.addEventListener('resize', setupCanvases);
        return () => window.removeEventListener('resize', setupCanvases);
    }, [src, setupCanvases]);

    useEffect(() => {
        setImagePos({
            x: (canvasSize.width - displayImageSize.width) / 2,
            y: (canvasSize.height - displayImageSize.height) / 2,
        });
    }, [canvasSize, displayImageSize]);

    useEffect(() => {
        const maskCanvas = maskCanvasRef.current;
        if (maskCanvas) {
            const ctx = maskCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            }
            maskCanvas.width = canvasSize.width;
            maskCanvas.height = canvasSize.height;
        }
    }, [canvasSize]);

    const handleConfirm = async () => {
        if (!imageRef.current) return;
        const originalImage = imageRef.current;
        const scaleToNatural = naturalImageSize.width / displayImageSize.width;

        const finalW = Math.round(canvasSize.width * scaleToNatural);
        const finalH = Math.round(canvasSize.height * scaleToNatural);

        // 1. Create the base image with transparent background
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = finalW;
        baseCanvas.height = finalH;
        const baseCtx = baseCanvas.getContext('2d');
        if (!baseCtx) return;
        const imgX = Math.round(imagePos.x * scaleToNatural);
        const imgY = Math.round(imagePos.y * scaleToNatural);
        baseCtx.drawImage(originalImage, imgX, imgY, naturalImageSize.width, naturalImageSize.height);
        const baseImageWithTransparency = baseCanvas.toDataURL('image/png');

        // 2. Create the mask
        const finalMaskCanvas = document.createElement('canvas');
        finalMaskCanvas.width = finalW;
        finalMaskCanvas.height = finalH;
        const finalMaskCtx = finalMaskCanvas.getContext('2d');
        if (!finalMaskCtx) return;
        
        // White for outpainting areas
        finalMaskCtx.fillStyle = 'white';
        finalMaskCtx.fillRect(0, 0, finalW, finalH);
        
        // Draw inpainting mask from the display canvas
        if (maskCanvasRef.current) {
            finalMaskCtx.drawImage(maskCanvasRef.current, 0, 0, finalW, finalH);
        }

        // Black for original image area (unchanged)
        finalMaskCtx.globalCompositeOperation = 'destination-out';
        finalMaskCtx.fillStyle = 'white';
        finalMaskCtx.fillRect(imgX, imgY, naturalImageSize.width, naturalImageSize.height);
        finalMaskCtx.globalCompositeOperation = 'source-over'; // reset

        const finalMaskImage = finalMaskCanvas.toDataURL('image/png');
        
        const divisor = (a: number, b: number): number => (b === 0 ? a : divisor(b, a % b));
        const d = divisor(finalW, finalH);
        
        onConfirm({
            image: baseImageWithTransparency,
            mask: finalMaskImage,
            aspectRatio: `${finalW / d}:${finalH / d}`
        });
        onClose();
    };

    // --- Drag Handle Logic ---
    const handleHandleMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: string) => {
        e.preventDefault(); e.stopPropagation();
        setIsDraggingHandle(true); setDragHandle(handle); setDragStart({ x: e.clientX, y: e.clientY });
    };
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingHandle || !dragHandle) return;
        const dx = (e.clientX - dragStart.x);
        const dy = (e.clientY - dragStart.y);
        
        setCanvasSize(prev => {
            let newW = prev.width;
            let newH = prev.height;
            if (dragHandle.includes('right')) newW = Math.max(displayImageSize.width, Math.min(MAX_SIZE, prev.width + dx * 2));
            if (dragHandle.includes('left')) newW = Math.max(displayImageSize.width, Math.min(MAX_SIZE, prev.width - dx * 2));
            if (dragHandle.includes('bottom')) newH = Math.max(displayImageSize.height, Math.min(MAX_SIZE, prev.height + dy * 2));
            if (dragHandle.includes('top')) newH = Math.max(displayImageSize.height, Math.min(MAX_SIZE, prev.height - dy * 2));
            return { width: newW, height: newH };
        });
        setDragStart({ x: e.clientX, y: e.clientY });
    }, [isDraggingHandle, dragHandle, dragStart, displayImageSize]);
    const handleGlobalMouseUp = useCallback(() => setIsDraggingHandle(false), []);

    useEffect(() => {
        if (isDraggingHandle) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleGlobalMouseMove);
                window.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isDraggingHandle, handleGlobalMouseMove, handleGlobalMouseUp]);


    // --- Drawing Logic ---
    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const ctx = maskCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        const { x, y } = getCoords(e);
        setIsDrawing(true);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const ctx = maskCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    const stopDrawing = () => setIsDrawing(false);


    const handles = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full h-full bg-slate-900 p-4 rounded-lg shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="w-full flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white">編輯畫布</h2>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setTool('brush')} className={`px-3 py-1.5 text-sm rounded-md ${tool === 'brush' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>筆刷</button>
                        <button onClick={() => setTool('eraser')} className={`px-3 py-1.5 text-sm rounded-md ${tool === 'eraser' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>橡皮擦</button>
                        <input type="range" min="10" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24" />
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                </header>
                
                <div ref={containerRef} className="flex-grow w-full h-full bg-slate-800/50 rounded-md flex items-center justify-center relative border-2 border-dashed border-slate-700 bg-[conic-gradient(from_90deg_at_1px_1px,#2d3748_90deg,transparent_0)] [background-size:20px_20px]">
                    {displayImageSize.width > 0 && (
                        <div className="absolute" style={{ width: canvasSize.width, height: canvasSize.height }}>
                            <div className="absolute bg-no-repeat bg-center bg-contain" style={{ backgroundImage: `url(${src})`, width: displayImageSize.width, height: displayImageSize.height, left: imagePos.x, top: imagePos.y }} />
                            <canvas ref={maskCanvasRef} className="absolute inset-0 cursor-crosshair touch-none"
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                            
                            {handles.map(h => <div key={h} onMouseDown={e => handleHandleMouseDown(e, h)} className="absolute w-4 h-4 bg-sky-500 border-2 border-white rounded-full -m-2 z-10" style={{ top: h.includes('top') ? 0 : h.includes('bottom') ? '100%' : '50%', left: h.includes('left') ? 0 : h.includes('right') ? '100%' : '50%', cursor: (h === 'top-left' || h === 'bottom-right') ? 'nwse-resize' : (h === 'top-right' || h === 'bottom-left') ? 'nesw-resize' : (h.includes('top') || h.includes('bottom')) ? 'ns-resize' : 'ew-resize' }} />)}
                        </div>
                    )}
                </div>

                <footer className="w-full mt-4 flex justify-center flex-shrink-0">
                    <button onClick={handleConfirm} className="px-8 py-3 text-lg bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors">
                        確認編輯並生成
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default GenerativeCanvas;