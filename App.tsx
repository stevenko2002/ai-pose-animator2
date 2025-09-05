
import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import DrawingCanvas from './components/DrawingCanvas';
import GeneratedImage from './components/GeneratedImage';
import { generateImageFromPose } from './services/geminiService';
import type { GenerationResult } from './types';

const App: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult>({ image: null, text: null });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = useCallback((base64: string | null) => {
    setUploadedImage(base64);
  }, []);

  const handleCanvasUpdate = useCallback((dataUrl: string | null) => {
    setCanvasImage(dataUrl);
  }, []);

  const handleGenerate = async () => {
    if (!uploadedImage || !canvasImage) {
      setError("Please upload an image and draw a pose on the canvas first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenerationResult({ image: null, text: null });

    try {
      const result = await generateImageFromPose(uploadedImage, canvasImage);
      setGenerationResult(result);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          AI Pose Animator
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Upload a photo, draw a stick figure pose, and let AI bring your character to life in that pose!
        </p>
      </header>
      
      <main className="w-full flex flex-col items-center">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader onImageUpload={handleImageUpload} />
          <DrawingCanvas onCanvasUpdate={handleCanvasUpdate} />
        </div>

        <div className="my-8">
          <button
            onClick={handleGenerate}
            disabled={!uploadedImage || !canvasImage || isLoading}
            className="px-10 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isLoading ? 'Generating...' : '✨ Generate Image'}
          </button>
        </div>

        <GeneratedImage 
          imageSrc={generationResult.image}
          text={generationResult.text}
          isLoading={isLoading}
          error={error}
        />
      </main>

      <footer className="mt-12 text-center text-slate-500 text-sm">
        <p>Powered by Google Gemini. Built with React & Tailwind CSS.</p>
      </footer>
    </div>
  );
};

export default App;
