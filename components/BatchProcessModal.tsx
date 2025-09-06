import React, { useState, useRef } from 'react';
import type { GenerationResult } from '../types';

interface BatchProcessModalProps {
  onClose: () => void;
  onStart: (prompts: string[]) => void;
  isRunning: boolean;
  results: GenerationResult[];
  currentIndex: number;
  prompts: string[];
}

const BatchProcessModal: React.FC<BatchProcessModalProps> = ({ onClose, onStart, isRunning, results, currentIndex, prompts }) => {
  const [promptInput, setPromptInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setPromptInput(text);
      };
      reader.readAsText(file);
    }
  };

  const handleStart = () => {
    const promptList = promptInput.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (promptList.length > 0) {
      onStart(promptList);
    }
  };
  
  const totalPrompts = prompts.length;
  const progressPercent = totalPrompts > 0 ? ((currentIndex + 1) / totalPrompts) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl h-[90vh] bg-slate-900 p-6 rounded-lg shadow-2xl flex flex-col border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <header className="w-full flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-white">批次處理模式</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
        </header>
        
        {!isRunning && (
            <div className="flex flex-col gap-4 flex-grow min-h-0">
                <p className="text-slate-400">在此處輸入或貼上多個提示詞 (每行一個)，或上傳一個 .txt 檔案。應用程式將使用目前的角色和風格設定為每個提示詞生成一張圖片。</p>
                <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="a cat wearing a hat&#x0a;a dog riding a skateboard&#x0a;a bird singing on a branch"
                    className="w-full h-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 resize-none"
                    aria-label="Batch prompts input"
                />
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                    <div>
                        <input type="file" accept=".txt" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700">
                            上傳 .txt 檔案
                        </button>
                    </div>
                    <button onClick={handleStart} disabled={!promptInput.trim()} className="px-6 py-3 text-lg bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        開始批次處理
                    </button>
                </div>
            </div>
        )}
        
        {isRunning && (
            <div className="flex flex-col gap-4 flex-grow min-h-0">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-lg font-semibold text-sky-300">處理中...</p>
                        <p className="font-mono text-slate-300">{currentIndex + 1} / {totalPrompts}</p>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5">
                        <div className="bg-sky-500 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <p className="text-slate-400 mt-2 text-sm truncate">目前提示詞: {prompts[currentIndex]}</p>
                </div>
                <div className="flex-grow bg-slate-800/50 p-4 rounded-lg overflow-y-auto">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {results.map((result, index) => (
                                <img key={index} src={result.image!} alt={`Batch result ${index}`} className="w-full h-auto object-cover rounded-md" />
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <p>生成的圖片將顯示在此處...</p>
                        </div>
                    )}
                </div>
                 <div className="text-center mt-2 flex-shrink-0">
                     <p className="text-sm text-yellow-400">請勿關閉此視窗，直到批次處理完成。</p>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default BatchProcessModal;
