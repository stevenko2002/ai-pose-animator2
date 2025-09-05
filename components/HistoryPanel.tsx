import React from 'react';
import type { GenerationResult } from '../types';

interface HistoryPanelProps {
  history: GenerationResult[];
  onSelect: (result: GenerationResult) => void;
  onUseAsInput: (image: string) => void;
  activeImageSrc: string | null;
  activeVideoSrc: string | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelect, onUseAsInput, activeImageSrc, activeVideoSrc }) => {
  if (history.length === 0) {
    return null;
  }
  
  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const HistoryItem: React.FC<{ item: GenerationResult, index: number }> = ({ item, index }) => {
    const isActive = (item.image && item.image === activeImageSrc) || (item.video && item.video === activeVideoSrc);
    const isVideo = !!item.video;
    
    return (
      <div
        className="group relative flex-shrink-0 w-32 h-32 rounded-md overflow-hidden cursor-pointer bg-slate-900"
        onClick={() => onSelect(item)}
      >
        {isVideo ? (
            <video
                src={item.video!}
                muted
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                className={`w-full h-full object-cover transition-all duration-300 ${isActive ? 'ring-4 ring-sky-500' : 'ring-2 ring-transparent group-hover:ring-sky-600'}`}
            />
        ) : (
            <img
                src={item.image!}
                alt={`History item ${index + 1}`}
                className={`w-full h-full object-cover transition-all duration-300 ${isActive ? 'ring-4 ring-sky-500' : 'ring-2 ring-transparent group-hover:ring-sky-600'}`}
            />
        )}
        
        {isVideo && (
             <div className="absolute top-1 left-1 bg-black/50 p-1 rounded-full pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
             </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-2 space-y-1">
          {!isVideo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (item.image) onUseAsInput(item.image);
              }}
              className="w-full px-2 py-1 text-xs bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
              title="Use as Input"
            >
              ✨ Use as Input
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const url = item.video || item.image;
              if (url) {
                const filename = isVideo ? `history_video_${index + 1}.mp4` : `history_image_${index + 1}.png`;
                downloadMedia(url, filename);
              }
            }}
            className="w-full px-2 py-1 text-xs bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
            title="Save"
          >
            Save {isVideo ? 'Video' : 'Image'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mt-8">
      <h3 className="text-xl font-semibold text-white mb-4 text-center">History (Last 10)</h3>
      <div className="flex space-x-4 p-4 bg-slate-800 rounded-lg shadow-lg overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900">
        {history.map((item, index) => (
          (item.image || item.video) && <HistoryItem key={index} item={item} index={index} />
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;
