

import React from 'react';
import type { GenerationResult } from '../types';

interface HistoryPanelProps {
  history: GenerationResult[];
  onSelect: (result: GenerationResult) => void;
  onUseAsInput: (image: string, slotIndex: number) => void;
  onZoom: (url: string) => void;
  onDelete: (result: GenerationResult) => void;
  onClearAll: () => void;
  activeImageSrc: string | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelect, onUseAsInput, onZoom, onDelete, onClearAll, activeImageSrc }) => {
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
    const isActive = item.image && item.image === activeImageSrc;
    
    return (
      <div
        className="group relative flex-shrink-0 w-32 h-32 rounded-md overflow-hidden cursor-pointer bg-slate-900"
        onClick={() => onSelect(item)}
      >
        <img
            src={item.image!}
            alt={`History item ${index + 1}`}
            className={`w-full h-full object-cover transition-all duration-300 ${isActive ? 'ring-4 ring-sky-500' : 'ring-2 ring-transparent group-hover:ring-sky-600'}`}
        />

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-2 space-y-1">
          <div className="w-full">
            <div className="text-center text-[10px] text-slate-300">Use as Input</div>
            <div className="flex justify-center items-center gap-1 mt-0.5">
                {[0, 1, 2].map(slotIndex => (
                    <button
                        key={slotIndex}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.image) onUseAsInput(item.image, slotIndex);
                        }}
                        className="w-7 h-6 text-xs bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                        title={`Use in Slot ${slotIndex + 1}`}
                    >
                        {slotIndex + 1}
                    </button>
                ))}
            </div>
          </div>
           <button
              onClick={(e) => {
                  e.stopPropagation();
                  if (item.image) onZoom(item.image);
              }}
              className="w-full px-2 py-1 text-xs bg-slate-500 text-white font-semibold rounded-md hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"
              title="Zoom Image"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H5a1 1 0 110-2h1V7a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Zoom
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (item.image) {
                downloadMedia(item.image, `history_image_${index + 1}.png`);
              }
            }}
            className="w-full px-2 py-1 text-xs bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
            title="Save"
          >
            Save Image
          </button>
        </div>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-600/90 text-white rounded-full flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all transform hover:scale-110"
            title="Delete from history"
            aria-label={`Delete history item ${index + 1}`}
        >
          &times;
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mt-8">
      <div className="flex justify-center items-center mb-4 relative">
        <h3 className="text-xl font-semibold text-white text-center">History (Last 10)</h3>
        <button
            onClick={onClearAll}
            className="absolute right-0 px-3 py-1 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            title="Clear all history"
        >
            Clear All
        </button>
      </div>
      <div className="flex space-x-4 p-4 bg-slate-800 rounded-lg shadow-lg overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900">
        {history.map((item, index) => (
          item.image && <HistoryItem key={index} item={item} index={index} />
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;