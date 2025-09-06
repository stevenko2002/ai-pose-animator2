import React, { useState } from 'react';
import type { GenerationResult, GroundingChunk } from '../types';

const generateRandomString = () => Math.random().toString(36).substring(2, 10);

interface GeneratedResultProps {
    id?: string;
    results: GenerationResult[];
    isLoading: boolean;
    loadingMessage: string;
    error: string | null;
    onUseAsInput: (image: string, slotIndex: number) => void;
    onZoom: (image: string) => void;
    onStartEditing: (imageSrc: string) => void;
    onUpscale: (image: string) => void;
    isEditing: boolean;
}

const LoadingSpinner: React.FC<{ loadingMessage: string }> = ({ loadingMessage }) => {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500"></div>
            <p className="text-white text-lg">{loadingMessage}</p>
        </div>
    );
};

const GroundingSources: React.FC<{ chunks: GroundingChunk[] }> = ({ chunks }) => {
    if (!chunks || chunks.length === 0) return null;

    const uniqueSources = chunks.reduce((acc, chunk) => {
        if (chunk.web && chunk.web.uri && !acc.some(item => item.uri === chunk.web.uri)) {
            acc.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
        }
        return acc;
    }, [] as { uri: string, title: string }[]);
    
    if (uniqueSources.length === 0) return null;

    return (
        <div className="mt-4 w-full bg-slate-950/50 p-3 rounded-lg border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">參考來源:</h4>
            <ul className="list-disc list-inside space-y-1">
                {uniqueSources.map((source, index) => (
                    <li key={index} className="text-xs text-sky-400 truncate">
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline" title={source.title}>
                            {source.title}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};


const ResultCard: React.FC<{
    result: GenerationResult;
    onUseAsInput: (image: string, slotIndex: number) => void;
    onZoom: (image: string) => void;
    onStartEditing: (imageSrc: string) => void;
    onUpscale: (image: string) => void;
    isEditing: boolean;
}> = ({ result, onUseAsInput, onZoom, onStartEditing, onUpscale, isEditing }) => {
    const [isUseAsInputOpen, setIsUseAsInputOpen] = useState(false);
    const { image, text, groundingChunks, seed } = result;

    if (!image) return null;

    const downloadMedia = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="relative flex flex-col items-center bg-slate-900/50 p-4 rounded-lg">
            <div
                onClick={() => !isEditing && onZoom(image)}
                className={`${!isEditing ? 'cursor-zoom-in' : ''} group relative w-full`}
                title={!isEditing ? "點擊縮放" : ''}
            >
                <img src={image} alt="Generated" className="w-full h-auto rounded-md shadow-2xl" />
                {!isEditing && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                  </div>
                )}
            </div>

            {text && <p className="mt-4 text-slate-300 italic text-center text-sm">"{text}"</p>}
            {seed && <p className="mt-2 text-xs text-slate-500 font-mono">Seed: {String(seed)}</p>}
            <GroundingSources chunks={groundingChunks || []} />
            <div className="mt-6 flex flex-wrap justify-center gap-2">
                <div className="relative" onMouseLeave={() => setIsUseAsInputOpen(false)}>
                    <button
                        onClick={() => setIsUseAsInputOpen(prev => !prev)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        disabled={isEditing}
                    >
                        ✨ 作為輸入
                    </button>
                    {isUseAsInputOpen && (
                        <div className="absolute bottom-full mb-2 w-full bg-slate-700 rounded-lg shadow-lg z-20 p-1">
                            {[0, 1, 2].map((slotIndex) => (
                                <button
                                    key={slotIndex}
                                    onClick={() => {
                                        onUseAsInput(image, slotIndex);
                                        setIsUseAsInputOpen(false);
                                    }}
                                    className="block w-full text-center px-4 py-2 text-sm text-white rounded-md hover:bg-blue-600 transition-colors"
                                >
                                    至欄位 {slotIndex + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                 <button
                    onClick={() => onStartEditing(image)}
                    className="px-4 py-2 text-sm bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors"
                    disabled={isEditing}
                >
                    編輯畫布
                </button>
                 <button
                    onClick={() => onUpscale(image)}
                    className="px-4 py-2 text-sm bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                    disabled={isEditing}
                >
                    🚀 畫質提升
                </button>
                <button
                    onClick={() => downloadMedia(image, `generated_image_${generateRandomString()}.png`)}
                    className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    disabled={isEditing}
                >
                    儲存圖片
                </button>
            </div>
        </div>
    );
};

const GeneratedResult: React.FC<GeneratedResultProps> = ({ 
    id, results, isLoading, loadingMessage, error, 
    onUseAsInput, onZoom,
    onStartEditing, onUpscale, isEditing
}) => {
    return (
        <div id={id} className="w-full max-w-5xl mt-8 p-6 bg-slate-800 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-2xl font-bold text-white mb-4">生成結果</h3>
            <div className="w-full h-full flex items-center justify-center">
                {isLoading ? (
                    <LoadingSpinner loadingMessage={loadingMessage} />
                ) : error ? (
                    <div className="w-full max-w-md text-center bg-red-900/50 border border-red-700 p-6 rounded-lg flex flex-col items-center gap-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="font-bold text-lg text-red-300">生成失敗</h4>
                            <p className="text-red-400 mt-1">{error}</p>
                        </div>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {results.map((result, index) => (
                           <ResultCard 
                                key={result.image || index}
                                result={result} 
                                onUseAsInput={onUseAsInput} 
                                onZoom={onZoom}
                                onStartEditing={onStartEditing}
                                onUpscale={onUpscale}
                                isEditing={isEditing}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-400">
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                        <p className="mt-2">您 AI 生成的圖片將會顯示在這裡。</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneratedResult;