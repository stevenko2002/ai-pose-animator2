// Fix: Import useRef from 'react'
import React, { useState, useEffect, useRef } from 'react';
import type { ControlLayers, Pose, ControlLayerData } from '../types';
import PoseEditor from './PoseEditor';
import DrawingCanvas from './DrawingCanvas';

const COLORS = ['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

interface ControlLayersProps {
    controlLayers: ControlLayers;
    onLayersUpdate: (layers: ControlLayers) => void;
    initialPose: Pose | null;
    poseSourceImage: string | null;
    onClearPose: () => void;
}

const ControlLayer: React.FC<{ title: string; children: React.ReactNode; isActive: boolean; onToggle: () => void; weight: number; onWeightChange: (weight: number) => void; hasContent: boolean; }> = ({ title, children, isActive, onToggle, weight, onWeightChange, hasContent }) => {
    return (
        <details className="bg-slate-900/50 rounded-lg" open={isActive}>
            <summary className="cursor-pointer p-3 flex justify-between items-center" onClick={(e) => { e.preventDefault(); onToggle(); }}>
                <span className="font-semibold text-white">{title}</span>
                <div className={`w-10 h-6 flex items-center rounded-full transition-colors ${isActive && hasContent ? 'bg-sky-600' : 'bg-slate-600'}`}>
                    <span className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isActive && hasContent ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
            </summary>
            <div className="p-4 border-t border-slate-700">
                {children}
                {isActive && hasContent && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <label htmlFor={`weight-${title}`} className="block text-sm font-medium text-slate-300 mb-2">
                            控制強度: <span className="font-mono">{weight}%</span>
                        </label>
                        <input
                            id={`weight-${title}`}
                            type="range"
                            min="0"
                            max="200"
                            step="5"
                            value={weight}
                            onChange={(e) => onWeightChange(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}
            </div>
        </details>
    );
};


const ImageControl: React.FC<{ image: string | null; onImageChange: (dataUrl: string | null) => void; typeLabel: string; }> = ({ image, onImageChange, typeLabel }) => {
    const [isDragging, setIsDragging] = useState(false);

    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => onImageChange(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div className="flex flex-col items-center">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative w-full h-[250px] border-2 rounded-md flex items-center justify-center bg-slate-900 overflow-hidden transition-all duration-300 ${isDragging ? 'border-solid border-sky-500' : 'border-dashed border-slate-600'}`}
            >
                {image ? (
                    <img src={image} alt="Control map preview" className="w-full h-full object-contain" />
                ) : (
                    <div className="text-center text-slate-400 p-4 pointer-events-none">
                        <p>{`拖放或選擇 ${typeLabel}`}</p>
                    </div>
                )}
            </div>
            <div className="mt-3 flex gap-2">
                <label className="cursor-pointer px-4 py-1.5 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">
                    選擇檔案
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && processFile(e.target.files[0])} />
                </label>
                {image && <button onClick={() => onImageChange(null)} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">移除</button>}
            </div>
        </div>
    );
};

const ScribbleControl: React.FC<{ onScribbleChange: (dataUrl: string | null) => void; }> = ({ onScribbleChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeColor, setActiveColor] = useState('#FFFFFF');

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            setContext(ctx);
        }
    }, []);
    
    useEffect(() => {
        if(context) {
           context.strokeStyle = activeColor;
           context.lineWidth = 8;
        }
    }, [context, activeColor]);
    
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!context) return;
        const { x, y } = getCoordinates(e);
        setIsDrawing(true);
        context.beginPath();
        context.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !context) return;
        const { x, y } = getCoordinates(e);
        context.lineTo(x, y);
        context.stroke();
    };
    
    const stopDrawing = () => {
        if(!context || !canvasRef.current) return;
        context.closePath();
        setIsDrawing(false);
        onScribbleChange(canvasRef.current.toDataURL('image/png'));
    };

    const clearCanvas = () => {
        if(context && canvasRef.current) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            onScribbleChange(null);
        }
    };
    
    return (
        <div className="flex flex-col items-center">
             <canvas
                ref={canvasRef}
                width={350}
                height={250}
                className="bg-slate-900 rounded-md cursor-crosshair border-2 border-dashed border-slate-600 touch-none"
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
            />
            <div className="mt-3 flex flex-col items-center gap-3">
                <div className="flex gap-2">
                    {COLORS.map(color => (
                        <button key={color} onClick={() => setActiveColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${activeColor === color ? 'border-sky-400' : 'border-slate-600'}`}
                            style={{ backgroundColor: color }} aria-label={`Select color ${color}`} />
                    ))}
                </div>
                <button onClick={clearCanvas} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">清除塗鴉</button>
            </div>
        </div>
    );
};


const ControlLayersManager: React.FC<ControlLayersProps> = ({ controlLayers, onLayersUpdate, initialPose, poseSourceImage, onClearPose }) => {
    
    const [activeLayers, setActiveLayers] = useState<Record<keyof ControlLayers, boolean>>({
        pose: !!controlLayers.pose.image,
        canny: !!controlLayers.canny.image,
        depth: !!controlLayers.depth.image,
        scribble: !!controlLayers.scribble.image,
    });
    
    useEffect(() => {
        setActiveLayers({
            pose: !!controlLayers.pose.image,
            canny: !!controlLayers.canny.image,
            depth: !!controlLayers.depth.image,
            scribble: !!controlLayers.scribble.image,
        })
    }, [controlLayers.pose.image, controlLayers.canny.image, controlLayers.depth.image, controlLayers.scribble.image]);

    const handleToggleLayer = (layer: keyof ControlLayers) => {
        const newActiveState = !activeLayers[layer];
        if (!newActiveState) {
            // If turning off, clear the image for that layer
            onLayersUpdate({ ...controlLayers, [layer]: { ...controlLayers[layer], image: null } });
        }
        setActiveLayers(prev => ({ ...prev, [layer]: newActiveState }));
    };
    
    const updateLayerData = (layer: keyof ControlLayers, data: Partial<ControlLayerData>) => {
        const newLayerData = { ...controlLayers[layer], ...data };
        if (newLayerData.image && !activeLayers[layer]) {
            setActiveLayers(prev => ({...prev, [layer]: true }));
        }
        if (!newLayerData.image) {
            setActiveLayers(prev => ({...prev, [layer]: false }));
        }
        onLayersUpdate({ ...controlLayers, [layer]: newLayerData });
    };

    return (
        <div className="flex flex-col w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">2. 控制圖層</h3>
            <div className="space-y-2">
                <ControlLayer 
                    title="姿勢引導 (Pose)" 
                    isActive={activeLayers.pose} 
                    onToggle={() => handleToggleLayer('pose')}
                    weight={controlLayers.pose.weight}
                    onWeightChange={(w) => updateLayerData('pose', { weight: w })}
                    hasContent={!!controlLayers.pose.image}
                >
                    {initialPose ? (
                        <PoseEditor
                            initialPose={initialPose}
                            backgroundImage={poseSourceImage}
                            onCanvasUpdate={(img) => updateLayerData('pose', { image: img })}
                            onClear={onClearPose}
                        />
                    ) : (
                        <DrawingCanvas onCanvasUpdate={(img) => updateLayerData('pose', { image: img })} />
                    )}
                </ControlLayer>

                <ControlLayer 
                    title="線條稿 (Canny Edge)" 
                    isActive={activeLayers.canny} 
                    onToggle={() => handleToggleLayer('canny')}
                    weight={controlLayers.canny.weight}
                    onWeightChange={(w) => updateLayerData('canny', { weight: w })}
                    hasContent={!!controlLayers.canny.image}
                >
                    <ImageControl image={controlLayers.canny.image} onImageChange={(img) => updateLayerData('canny', { image: img })} typeLabel="線條稿" />
                </ControlLayer>
                
                <ControlLayer 
                    title="深度圖 (Depth Map)" 
                    isActive={activeLayers.depth} 
                    onToggle={() => handleToggleLayer('depth')}
                    weight={controlLayers.depth.weight}
                    onWeightChange={(w) => updateLayerData('depth', { weight: w })}
                    hasContent={!!controlLayers.depth.image}
                >
                     <ImageControl image={controlLayers.depth.image} onImageChange={(img) => updateLayerData('depth', { image: img })} typeLabel="深度圖" />
                </ControlLayer>

                <ControlLayer 
                    title="塗鴉引導 (Scribble)" 
                    isActive={activeLayers.scribble} 
                    onToggle={() => handleToggleLayer('scribble')}
                    weight={controlLayers.scribble.weight}
                    onWeightChange={(w) => updateLayerData('scribble', { weight: w })}
                    hasContent={!!controlLayers.scribble.image}
                >
                    <ScribbleControl onScribbleChange={(img) => updateLayerData('scribble', { image: img })} />
                </ControlLayer>
            </div>
        </div>
    );
};

export default ControlLayersManager;