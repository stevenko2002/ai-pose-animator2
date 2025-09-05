import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Pose, Keypoint } from '../types';

const generateRandomString = () => Math.random().toString(36).substring(2, 10);

// Pre-defined skeleton connections
const SKELETON_CONNECTIONS: [keyof typeof POSE_MAP, keyof typeof POSE_MAP][] = [
    ['nose', 'left_eye'], ['left_eye', 'left_ear'],
    ['nose', 'right_eye'], ['right_eye', 'right_ear'],
    ['nose', 'left_shoulder'], ['nose', 'right_shoulder'],
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
];

const POSE_MAP = {
    nose: 0, left_eye: 1, right_eye: 2, left_ear: 3, right_ear: 4,
    left_shoulder: 5, right_shoulder: 6, left_elbow: 7, right_elbow: 8,
    left_wrist: 9, right_wrist: 10, left_hip: 11, right_hip: 12,
    left_knee: 13, right_knee: 14, left_ankle: 15, right_ankle: 16
};

interface PoseEditorProps {
  initialPose: Pose;
  onCanvasUpdate: (dataUrl: string | null) => void;
  onClear: () => void;
  backgroundImage: string | null;
}

const PoseEditor: React.FC<PoseEditorProps> = ({ initialPose, onCanvasUpdate, onClear, backgroundImage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pose, setPose] = useState<Pose>(initialPose);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);

  const getCanvasContext = useCallback(() => canvasRef.current?.getContext('2d'), []);
  
  const drawPose = useCallback((currentPose: Pose) => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const keypointsByName = new Map(currentPose.map(p => [p.name, p]));

    // Draw skeleton lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    SKELETON_CONNECTIONS.forEach(([startName, endName]) => {
      const startPoint = keypointsByName.get(startName);
      const endPoint = keypointsByName.get(endName);
      if (startPoint && endPoint) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw keypoints
    currentPose.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#0ea5e9'; // sky-500
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [getCanvasContext]);

  useEffect(() => {
    setPose(initialPose);
  }, [initialPose]);

  useEffect(() => {
    drawPose(pose);
    if(canvasRef.current){
        onCanvasUpdate(canvasRef.current.toDataURL('image/png'));
    }
  }, [pose, drawPose, onCanvasUpdate]);

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
        downloadImage(canvasRef.current.toDataURL('image/png'), `edited_pose_${generateRandomString()}.png`);
    }
  };

  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCoordinates(event);
    
    // Find the closest keypoint
    let closestIndex = -1;
    let minDistance = Infinity;

    pose.forEach((point, index) => {
      const pointX = point.x * canvas.width;
      const pointY = point.y * canvas.height;
      const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2));
      if (distance < 15 && distance < minDistance) { // 15px grab radius
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== -1) {
      setDraggingIndex(closestIndex);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCoordinates(event);
    const newX = Math.min(Math.max(x / canvas.width, 0), 1);
    const newY = Math.min(Math.max(y / canvas.height, 0), 1);

    setPose(prevPose => {
      const newPose = [...prevPose];
      newPose[draggingIndex] = { ...newPose[draggingIndex], x: newX, y: newY };
      return newPose;
    });
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
  };
  
  const handleMouseLeave = () => {
    if (draggingIndex !== null) {
      handleMouseUp();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 bg-slate-800 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-white mb-4">2. 編輯姿勢</h3>
      <div className="relative" style={{ width: 350, height: 500 }}>
        {backgroundImage && (
          <img 
            src={backgroundImage} 
            alt="Pose reference" 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-md"
            style={{ opacity: backgroundOpacity }}
          />
        )}
        <canvas
          ref={canvasRef}
          width={350}
          height={500}
          className="relative bg-transparent rounded-md cursor-grab active:cursor-grabbing border-2 border-dashed border-slate-600 touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
      </div>
      
      {backgroundImage && (
        <div className="mt-4 w-full max-w-xs flex flex-col items-center">
          <label htmlFor="opacity-slider" className="text-sm text-slate-300 mb-2">
            參考圖透明度: {Math.round(backgroundOpacity * 100)}%
          </label>
          <input
            id="opacity-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={backgroundOpacity}
            onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <button
          onClick={onClear}
          className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          清除姿勢
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          儲存姿勢
        </button>
      </div>
    </div>
  );
};

export default PoseEditor;