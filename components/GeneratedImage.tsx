
import React from 'react';

interface GeneratedImageProps {
    imageSrc: string | null;
    text: string | null;
    isLoading: boolean;
    error: string | null;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500"></div>
        <p className="text-white text-lg">Generating your image... This may take a moment.</p>
    </div>
);

const GeneratedImage: React.FC<GeneratedImageProps> = ({ imageSrc, text, isLoading, error }) => {
    return (
        <div className="w-full max-w-2xl mt-8 p-6 bg-slate-800 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-2xl font-bold text-white mb-4">Generated Result</h3>
            <div className="w-full h-full flex items-center justify-center">
                {isLoading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-md">
                        <h4 className="font-bold text-lg">Error</h4>
                        <p>{error}</p>
                    </div>
                ) : imageSrc ? (
                    <div className="flex flex-col items-center">
                        <img src={imageSrc} alt="Generated" className="max-w-full max-h-[500px] rounded-md shadow-2xl" />
                        {text && <p className="mt-4 text-slate-300 italic text-center">"{text}"</p>}
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

export default GeneratedImage;
