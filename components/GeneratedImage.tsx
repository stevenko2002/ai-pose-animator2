

import React, { useState, useEffect } from 'react';

interface GeneratedResultProps {
    imageSrc: string | null;
    text: string | null;
    isLoading: boolean;
    loadingMessage: string;
    error: string | null;
    onUseAsInput: (image: string, slotIndex: number) => void;
    onZoom: (image: string) => void;
    uploadedImageCount: number;
    aspectRatio: string;
}

const LoadingSpinner: React.FC<{ loadingMessage: string }> = ({ loadingMessage }) => {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500"></div>
            <p className="text-white text-lg">{loadingMessage}</p>
        </div>
    );
};

const GeneratedResult: React.FC<GeneratedResultProps> = ({ 
    imageSrc, text, isLoading, loadingMessage, error, 
    onUseAsInput, onZoom, uploadedImageCount, aspectRatio
}) => {
    
    const [isUseAsInputOpen, setIsUseAsInputOpen] = useState(false);

    const downloadMedia = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <div className="w-full max-w-2xl mt-8 p-6 bg-slate-800 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-2xl font-bold text-white mb-4">Generated Result</h3>
            <div className="w-full h-full flex items-center justify-center">
                {isLoading ? (
                    <LoadingSpinner loadingMessage={loadingMessage} />
                ) : error ? (
                    <div className="w-full max-w-md text-center bg-red-900/50 border border-red-700 p-6 rounded-lg flex flex-col items-center gap-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="font-bold text-lg text-red-300">Generation Failed</h4>
                            <p className="text-red-400 mt-1">{error}</p>
                        </div>
                    </div>
                ) : imageSrc ? (
                    <div className="flex flex-col items-center">
                        <div
                            onClick={() => onZoom(imageSrc)}
                            className="cursor-zoom-in group relative"
                            title="Click to zoom"
                        >
                            <img src={imageSrc} alt="Generated" className="max-w-full max-h-[500px] rounded-md shadow-2xl" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                            </div>
                        </div>

                        {text && <p className="mt-4 text-slate-300 italic text-center">"{text}"</p>}
                        <div className="mt-6 flex flex-wrap justify-center gap-4">
                            <div className="relative" onMouseLeave={() => setIsUseAsInputOpen(false)}>
                                <button
                                    onClick={() => setIsUseAsInputOpen(prev => !prev)}
                                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    ✨ Use as Input
                                </button>
                                {isUseAsInputOpen && imageSrc && (
                                    <div className="absolute bottom-full mb-2 w-full bg-slate-700 rounded-lg shadow-lg z-10 p-1">
                                        {[0, 1, 2].map((slotIndex) => (
                                            <button
                                                key={slotIndex}
                                                onClick={() => {
                                                    onUseAsInput(imageSrc, slotIndex);
                                                    setIsUseAsInputOpen(false);
                                                }}
                                                className="block w-full text-center px-4 py-2 text-sm text-white rounded-md hover:bg-blue-600 transition-colors"
                                            >
                                                To Slot {slotIndex + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                             <button
                                onClick={() => onZoom(imageSrc)}
                                className="px-6 py-2 bg-slate-500 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                title="Zoom Image"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-2a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H5a1 1 0 110-2h1V7a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                Zoom
                            </button>
                            <button
                                onClick={() => downloadMedia(imageSrc, 'generated_image.png')}
                                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Save Image
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-400">
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                        <p className="mt-2">Your AI-generated image will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneratedResult;