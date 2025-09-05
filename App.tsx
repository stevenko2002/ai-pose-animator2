
import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import DrawingCanvas from './components/DrawingCanvas';
import PromptEditor from './components/PromptEditor';
import GeneratedResult from './components/GeneratedImage';
import HistoryPanel from './components/HistoryPanel';
import ImageModal from './components/ImageModal';
import { generateImageFromPose, editImageWithPrompt, generatePromptSuggestion, generateImageFromPrompt } from './services/geminiService';
import type { GenerationResult } from './types';

type AspectRatio = '1:1' | '16:9' | '4:3' | '9:16' | '3:4' | 'original';
type EditMode = 'pose' | 'prompt';

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
  const [promptTemplates, setPromptTemplates] = useState<string[]>([]);
  
  const [editMode, setEditMode] = useState<EditMode>(() => {
    const savedMode = localStorage.getItem('ai-pose-animator-editMode') as EditMode | null;
    return savedMode || 'pose';
  });

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => {
    const savedRatio = localStorage.getItem('ai-pose-animator-aspectRatio') as AspectRatio | null;
    const validRatios: AspectRatio[] = ['1:1', '16:9', '4:3', '9:16', '3:4'];
    return (savedRatio && validRatios.includes(savedRatio)) ? savedRatio : '1:1';
  });

  const [activeResult, setActiveResult] = useState<GenerationResult>({ image: null, text: null });
  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai-pose-animator-editMode', editMode);
  }, [editMode]);

  useEffect(() => {
    if (aspectRatio !== 'original') {
        localStorage.setItem('ai-pose-animator-aspectRatio', aspectRatio);
    }
  }, [aspectRatio]);
  
    // Load and save prompt templates
  useEffect(() => {
    try {
        const savedTemplates = localStorage.getItem('ai-pose-animator-promptTemplates');
        if (savedTemplates) {
            setPromptTemplates(JSON.parse(savedTemplates));
        }
    } catch (e) {
        console.error("Failed to load prompt templates from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('ai-pose-animator-promptTemplates', JSON.stringify(promptTemplates));
    } catch (e) {
        console.error("Failed to save prompt templates to localStorage", e);
    }
  }, [promptTemplates]);


  const handleImageUpload = useCallback((images: (string | null)[]) => {
    setUploadedImages(images);
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
    setPromptSuggestion(getRandomInitialPrompt());
    setActiveResult({ image: null, text: null });
    setError(null);
    setClearCanvasTrigger(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectFromHistory = (result: GenerationResult) => {
    setActiveResult(result);
  };
  
  const handleDeleteFromHistory = useCallback((resultToDelete: GenerationResult) => {
    setGenerationHistory(prev => prev.filter(result => result.image !== resultToDelete.image));
    if (activeResult.image === resultToDelete.image) {
      setActiveResult({ image: null, text: null });
    }
  }, [activeResult.image]);

  const handleClearHistory = useCallback(() => {
    setGenerationHistory([]);
    setActiveResult({ image: null, text: null });
  }, []);

  const handleZoomImage = useCallback((url: string) => {
    setZoomedImage(url);
  }, []);

  const handleRandomizeSuggestion = useCallback(() => {
    setPromptSuggestion(getRandomInitialPrompt());
  }, []);

  const handleSavePromptTemplate = useCallback((template: string) => {
    const trimmedTemplate = template.trim();
    if (trimmedTemplate && !promptTemplates.includes(trimmedTemplate)) {
        setPromptTemplates(prev => [trimmedTemplate, ...prev].slice(0, 20)); // Limit to 20 templates
    }
  }, [promptTemplates]);

  const handleDeletePromptTemplate = useCallback((template: string) => {
    setPromptTemplates(prev => prev.filter(t => t !== template));
  }, []);


  const handleGenerate = async () => {
    const validImages = uploadedImages.filter((img): img is string => img !== null);
    const hasPrompt = !!prompt && prompt.trim().length > 0;

    // Common setup
    setIsLoading(true);
    setError(null);
    setActiveResult({ image: null, text: null });
    setPromptSuggestion(null);

    try {
      let result: GenerationResult;
      
      let finalAspectRatio: string = aspectRatio;
      if (aspectRatio === 'original') {
        finalAspectRatio = validImages.length > 0 ? await getAspectRatioFromDataUrl(validImages[0]) : '1:1';
      }

      // Case 1: Prompt mode with NO images (Text-to-Image)
      if (editMode === 'prompt' && hasPrompt && validImages.length === 0) {
        setLoadingMessage('Creating image from prompt...');
        result = await generateImageFromPrompt(prompt!, finalAspectRatio);
      } 
      // Case 2: Pose mode (requires images and pose)
      else if (editMode === 'pose' && canvasImage && validImages.length > 0) {
        setLoadingMessage('Generating image from pose...');
        result = await generateImageFromPose(validImages, canvasImage, finalAspectRatio);
      }
      // Case 3: Prompt mode WITH images (Image Editing)
      else if (editMode === 'prompt' && hasPrompt && validImages.length > 0) {
        setLoadingMessage('Editing image with prompt...');
        result = await editImageWithPrompt(validImages, prompt!, finalAspectRatio);
      }
      // Case 4: Invalid state (should be caught by disabled button, but as a fallback)
      else {
          let errorMessage = "Please check your inputs. ";
          if (validImages.length === 0) errorMessage += "An input image is required for this mode. ";
          if (editMode === 'pose' && !canvasImage) errorMessage += "A pose drawing is required. ";
          if (editMode === 'prompt' && !hasPrompt) errorMessage += "A text prompt is required. ";
          throw new Error(errorMessage.trim());
      }
      
      // Common result handling
      setActiveResult(result);
      setGenerationHistory(prev => [result, ...prev].slice(0, 10));
      if (result.image) {
          generatePromptSuggestion(result.image)
            .then(setPromptSuggestion)
            .catch(err => {
                console.error("Failed to generate prompt suggestion:", err);
                setPromptSuggestion(getRandomInitialPrompt());
            });
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const hasImages = uploadedImages.some(img => img !== null);
  const hasPrompt = prompt && prompt.trim().length > 0;
  const hasPose = !!canvasImage;

  let isGenerateDisabled = isLoading;
  if (!isGenerateDisabled) {
      if (editMode === 'pose') {
          isGenerateDisabled = !hasImages || !hasPose;
      } else if (editMode === 'prompt') {
          isGenerateDisabled = !hasPrompt;
      }
  }

  const isOriginalDisabled = !hasImages;
  const uploadedImageCount = uploadedImages.filter(Boolean).length;
  const generateButtonText = isLoading ? (loadingMessage || 'Generating...') : (editMode === 'prompt' && !hasImages) ? '✨ Create Image' : '✨ Generate Image';

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

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          AI Pose Animator
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Upload photos, then draw a pose or describe an edit, and let AI bring your vision to life!
        </p>
      </header>
      
      <main className="w-full flex flex-col items-center">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader 
            onImageUpload={handleImageUpload} 
            images={uploadedImages}
          />
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
                    templates={promptTemplates}
                    onSaveTemplate={handleSavePromptTemplate}
                    onDeleteTemplate={handleDeletePromptTemplate}
                    uploadedImageCount={uploadedImageCount}
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
        
        <div className="my-6 flex flex-col items-center gap-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className={`px-10 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${isLoading ? 'animate-pulse' : ''}`}
            >
              {generateButtonText}
            </button>
        </div>

        <HistoryPanel
            history={generationHistory}
            onSelect={handleSelectFromHistory}
            onUseAsInput={handleUseAsInput}
            onZoom={handleZoomImage}
            onDelete={handleDeleteFromHistory}
            onClearAll={handleClearHistory}
            activeImageSrc={activeResult.image}
        />

        <GeneratedResult
          imageSrc={activeResult.image}
          text={activeResult.text}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          error={error}
          onUseAsInput={handleUseAsInput}
          onZoom={handleZoomImage}
          uploadedImageCount={uploadedImageCount}
          aspectRatio={aspectRatio}
        />

        {zoomedImage && <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      </main>

      <footer className="mt-12 text-center text-slate-500 text-sm">
        <p>Powered by Google Gemini. Built with React & Tailwind CSS.</p>
      </footer>
    </div>
  );
};

export default App;