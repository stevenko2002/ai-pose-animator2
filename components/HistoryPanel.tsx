import React from 'react';
import type { GenerationResult } from '../types';

interface HistoryPanelProps {
  history: GenerationResult[];
  onSelect: (result: GenerationResult) => void;
  onUseAsInput: (image: string) => void;
  activeImageSrc: string | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelect, onUseAsInput, activeImageSrc }) => {
  if (history.length === 0) {
    return null;
  }
  
  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-5xl mt-8">
      <h3 className="text-xl font-semibold text-white mb-4 text-center">History (Last 10)</h3>
      <div className="flex space-x-4 p-4 bg-slate-800 rounded-lg shadow-lg overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-900">
        {history.map((item, index) => (
          item.image && (
            <div
              key={index}
              className="group relative flex-shrink-0 w-32 h-32 rounded-md overflow-hidden cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <img
                src={item.image}
                alt={`History item ${index + 1}`}
                className={`w-full h-full object-cover transition-all duration-300 ${activeImageSrc === item.image ? 'ring-4 ring-sky-500' : 'ring-2 ring-transparent group-hover:ring-sky-600'}`}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-2 space-y-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent the parent onClick from firing
                    if (item.image) {
                      onUseAsInput(item.image);
                    }
                  }}
                  className="w-full px-2 py-1 text-xs bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  title="Use as Input"
                >
                  ✨ Use as Input
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent the parent onClick from firing
                    if (item.image) {
                      downloadImage(item.image, `history_image_${index + 1}.png`);
                    }
                  }}
                  className="w-full px-2 py-1 text-xs bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                  title="Save Image"
                >
                  Save
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;