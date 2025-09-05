import React from 'react';

interface GeneratedImageProps {
    imageSrc: string | null;
    text: string | null;
    isLoading: boolean;
    error: string | null;
    onUseAsInput: (image: string) => void;
    uploadedImageCount: number;
    aspectRatio: string;
}

const LoadingSpinner: React.FC<{ uploadedImageCount: number; aspectRatio: string; }> = ({ uploadedImageCount, aspectRatio }) => {
    const imageText = uploadedImageCount === 1 ? 'image' : 'images';
    const ratioText = aspectRatio === 'original' ? 'the original aspect ratio' : `a ${aspectRatio} aspect ratio`;

    return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-500"></div>
            <p className="text-white text-lg">Generating your image...</p>
            {uploadedImageCount > 0 && (
                <p className="text-slate-300 text-sm">
                    Using {uploadedImageCount} {imageText} with {ratioText}.
                </p>
            )}
        </div>
    );
};

const GeneratedImage: React.FC<GeneratedImageProps> = ({ imageSrc, text, isLoading, error, onUseAsInput, uploadedImageCount, aspectRatio }) => {
    const downloadImage = (dataUrl: string, filename: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
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
                    <LoadingSpinner uploadedImageCount={uploadedImageCount} aspectRatio={aspectRatio} />
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
                        <img src={imageSrc} alt="Generated" className="max-w-full max-h-[500px] rounded-md shadow-2xl" />
                        {text && <p className="mt-4 text-slate-300 italic text-center">"{text}"</p>}
                        <div className="mt-6 flex flex-wrap justify-center gap-4">
                            <button
                                onClick={() => onUseAsInput(imageSrc)}
                                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                ✨ Use as Input
                            </button>
                            <button
                                onClick={() => downloadImage(imageSrc, 'generated_image.png')}
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

export default GeneratedImage;