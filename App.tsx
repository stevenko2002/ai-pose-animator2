import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import DrawingCanvas from './components/DrawingCanvas';
import PromptEditor from './components/PromptEditor';
import GeneratedImage from './components/GeneratedImage';
import HistoryPanel from './components/HistoryPanel';
import { generateImageFromPose, editImageWithPrompt, generatePromptSuggestion } from './services/geminiService';
import type { GenerationResult } from './types';

type AspectRatio = '1:1' | '16:9' | '4:3' | '9:16' | '3:4' | 'original';

// Helper to calculate the greatest common divisor
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// Helper to get W:H aspect ratio string from a data URL
const getAspectRatioFromDataUrl = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > 0 && h > 0) {
        const divisor = gcd(w, h);
        resolve(`${w / divisor}:${h / divisor}`);
      } else {
        resolve('1:1'); // Fallback for invalid image dimensions
      }
    };
    img.onerror = () => {
      console.error("Could not determine image aspect ratio from data URL.");
      resolve('1:1'); // Fallback if image fails to load
    };
    img.src = dataUrl;
  });
};

const initialPrompts = [
  "A person doing a yoga pose in a serene forest.",
  "An astronaut floating in space, waving.",
  "A superhero landing dramatically on a rooftop.",
  "A chef enthusiastically tossing a pizza.",
  "A medieval knight holding a sword, in a defensive stance.",
  "A ballet dancer performing a graceful leap.",
  "Turn the photo into a classic oil painting.",
  "Change the background to a futuristic cityscape at night.",
  "Make the person wear stylish sunglasses and a leather jacket.",
  "Add a friendly golden retriever sitting next to the person."
];
const getRandomInitialPrompt = () => initialPrompts[Math.floor(Math.random() * initialPrompts.length)];


const App: React.FC = () => {
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(getRandomInitialPrompt);
  
  const [editMode, setEditMode] = useState<'pose' | 'prompt'>(() => {
    const savedMode = localStorage.getItem('ai-pose-animator-editMode');
    return (savedMode === 'pose' || savedMode === 'prompt') ? savedMode : 'pose';
  });

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => {
    const savedRatio = localStorage.getItem('ai-pose-animator-aspectRatio') as AspectRatio | null;
    const validRatios: AspectRatio[] = ['1:1', '16:9', '4:3', '9:16', '3:4'];
    return (savedRatio && validRatios.includes(savedRatio)) ? savedRatio : '1:1';
  });

  const [activeResult, setActiveResult] = useState<GenerationResult>({ image: null, text: null });
  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai-pose-animator-editMode', editMode);
  }, [editMode]);

  useEffect(() => {
    // Do not persist 'original' as it depends on a specific image being present,
    // which won't be the case on a fresh page load.
    if (aspectRatio !== 'original') {
        localStorage.setItem('ai-pose-animator-aspectRatio', aspectRatio);
    }
  }, [aspectRatio]);

  const handleImageUpload = useCallback((images: (string | null)[]) => {
    setUploadedImages(images);
    // If 'original' was selected but the first image is now removed, reset to default.
    if (!images[0] && aspectRatio === 'original') {
      setAspectRatio('1:1');
    }
  }, [aspectRatio]);

  const handleCanvasUpdate = useCallback((dataUrl: string | null) => {
    setCanvasImage(dataUrl);
  }, []);

  const handlePromptChange = useCallback((text: string) => {
    setPrompt(text);
  }, []);
  
  const handleUseAsInput = useCallback((image: string) => {
    setUploadedImages([image, null, null]);
    setCanvasImage(null);
    setPromptSuggestion(getRandomInitialPrompt()); // Set new random suggestion
    setActiveResult({ image: null, text: null }); // Clear current result
    setError(null);
    setClearCanvasTrigger(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectFromHistory = (result: GenerationResult) => {
    setActiveResult(result);
  };

  const handleRandomizeSuggestion = useCallback(() => {
    setPromptSuggestion(getRandomInitialPrompt());
  }, []);

  const handleGenerate = async () => {
    const validImages = uploadedImages.filter((img): img is string => img !== null);

    if (validImages.length === 0) {
      setError("Please upload at least one image first.");
      setActiveResult({ image: null, text: null });
      return;
    }

    const isPoseModeReady = editMode === 'pose' && !!canvasImage;
    const isPromptModeReady = editMode === 'prompt' && !!prompt && prompt.trim().length > 0;

    if (!isPoseModeReady && !isPromptModeReady) {
        if (editMode === 'pose') {
            setError("Please draw a pose on the canvas first.");
        } else {
            setError("Please enter a text prompt to describe your desired edits.");
        }
        setActiveResult({ image: null, text: null });
        return;
    }

    setIsLoading(true);
    setError(null);
    setActiveResult({ image: null, text: null });
    setPromptSuggestion(null); // Clear previous suggestion

    try {
      let finalAspectRatio: string = aspectRatio;
      if (aspectRatio === 'original') {
        if (uploadedImages[0]) {
          finalAspectRatio = await getAspectRatioFromDataUrl(uploadedImages[0]);
        } else {
          finalAspectRatio = '1:1';
        }
      }

      let result: GenerationResult;
      if (isPoseModeReady) {
        result = await generateImageFromPose(validImages, canvasImage!, finalAspectRatio);
      } else if (isPromptModeReady) {
        result = await editImageWithPrompt(validImages, prompt!, finalAspectRatio);
      } else {
          throw new Error("Invalid generation state.");
      }
      setActiveResult(result);
      setGenerationHistory(prev => [result, ...prev].slice(0, 10));

      // Asynchronously generate a new prompt suggestion based on the result
      if (result.image) {
          generatePromptSuggestion(result.image)
            .then(setPromptSuggestion)
            .catch(err => {
                console.error("Failed to generate prompt suggestion:", err);
                setPromptSuggestion(null); // Clear suggestion on error
            });
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const isGenerateDisabled = uploadedImages.every(img => img === null) || isLoading || (editMode === 'pose' && !canvasImage) || (editMode === 'prompt' && (!prompt || prompt.trim().length === 0));

  const AspectRatioButton: React.FC<{ value: AspectRatio; label: string; disabled?: boolean }> = ({ value, label, disabled }) => (
    <button
      onClick={() => !disabled && setAspectRatio(value)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${aspectRatio === value ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600'}`}
      aria-pressed={aspectRatio === value}
      disabled={disabled}
    >
      {label}
    </button>
  );

  const isOriginalDisabled = !uploadedImages[0];
  const uploadedImageCount = uploadedImages.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          AI Pose Animator
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Upload up to 3 photos, then draw a pose or describe an edit, and let AI bring your vision to life!
        </p>
      </header>
      
      <main className="w-full flex flex-col items-center">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader onImageUpload={handleImageUpload} images={uploadedImages} />
          <div className="flex flex-col w-full h-full">
            <div className="flex justify-center mb-4 gap-2 p-1 bg-slate-700 rounded-lg">
                <button 
                    onClick={() => setEditMode('pose')} 
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${editMode === 'pose' ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'}`}
                    aria-pressed={editMode === 'pose'}
                >
                    Draw a Pose
                </button>
                <button 
                    onClick={() => setEditMode('prompt')} 
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${editMode === 'prompt' ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'}`}
                    aria-pressed={editMode === 'prompt'}
                >
                    Edit with Prompt
                </button>
            </div>
            {editMode === 'pose' ? (
                <DrawingCanvas onCanvasUpdate={handleCanvasUpdate} clearTrigger={clearCanvasTrigger} />
            ) : (
                <PromptEditor 
                    prompt={prompt} 
                    onPromptChange={handlePromptChange} 
                    suggestion={promptSuggestion}
                    onRandomize={handleRandomizeSuggestion}
                />
            )}
          </div>
        </div>

        <div className="my-6 text-center w-full max-w-2xl">
            <h3 className="text-xl font-semibold text-white mb-3">3. Choose Aspect Ratio</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-1 bg-slate-700 rounded-lg">
                <AspectRatioButton value="1:1" label="1:1" />
                <AspectRatioButton value="16:9" label="16:9" />
                <AspectRatioButton value="4:3" label="4:3" />
                <AspectRatioButton value="9:16" label="9:16" />
                <AspectRatioButton value="3:4" label="3:4" />
                <AspectRatioButton value="original" label="Original" disabled={isOriginalDisabled} />
            </div>
        </div>

        <div className="my-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            className={`px-10 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${isLoading ? 'animate-pulse' : ''}`}
          >
            {isLoading ? 'Generating...' : '✨ Generate Image'}
          </button>
        </div>

        <HistoryPanel
            history={generationHistory}
            onSelect={handleSelectFromHistory}
            onUseAsInput={handleUseAsInput}
            activeImageSrc={activeResult.image}
        />

        <GeneratedImage 
          imageSrc={activeResult.image}
          text={activeResult.text}
          isLoading={isLoading}
          error={error}
          onUseAsInput={handleUseAsInput}
          uploadedImageCount={uploadedImageCount}
          aspectRatio={aspectRatio}
        />
      </main>

      <footer className="mt-12 text-center text-slate-500 text-sm">
        <p>Powered by Google Gemini. Built with React & Tailwind CSS.</p>
      </footer>
    </div>
  );
};

export default App;