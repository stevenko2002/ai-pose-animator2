import React from 'react';

interface StyleAnalyzerResultModalProps {
  text: string;
  onClose: () => void;
  onCopyToPrompt: (text: string) => void;
  onSaveAsTemplate: (text: string) => void;
}

const StyleAnalyzerResultModal: React.FC<StyleAnalyzerResultModalProps> = ({ text, onClose, onCopyToPrompt, onSaveAsTemplate }) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-slate-800 p-6 rounded-lg shadow-2xl flex flex-col items-center border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">風格分析結果</h2>
        <textarea
            readOnly
            value={text}
            className="w-full h-40 p-3 bg-slate-900 border border-slate-600 rounded-md text-slate-300 text-sm resize-none scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
            aria-label="Analyzed style prompt"
        />
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => onCopyToPrompt(text)}
            className="px-4 py-2 text-sm bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors"
          >
            複製到提示詞
          </button>
          <button
            onClick={() => onSaveAsTemplate(text)}
            className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            儲存為範本
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default StyleAnalyzerResultModal;
