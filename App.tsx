import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import DrawingCanvas from './components/DrawingCanvas';
import PoseEditor from './components/PoseEditor';
import PromptEditor from './components/PromptEditor';
import GeneratedResult from './components/GeneratedImage';
import HistoryPanel from './components/HistoryPanel';
import ImageModal from './components/ImageModal';
import SettingsManager from './components/SettingsManager';
import MaskEditor from './components/MaskEditor';
import { generateImageFromPose, editImageWithPrompt, generateImageFromPrompt, analyzePose, editImageWithMask } from './services/geminiService';
import type { GenerationResult, Pose } from './types';

type EditMode = 'pose' | 'prompt';
type CharacterLock = { index: number; lockAppearance: boolean; lockClothing: boolean; };

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

const PREDEFINED_ASPECT_RATIOS = ['1:1', '16:9', '4:3', '9:16', '3:4'];
const APP_VERSION = '1.2.0';

const App: React.FC = () => {
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [poseKeypoints, setPoseKeypoints] = useState<Pose | null>(null);
  const [poseSourceImage, setPoseSourceImage] = useState<string | null>(null);
  
  const [maskingImage, setMaskingImage] = useState<{ src: string, index: number } | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  
  const [lockedCharacter, setLockedCharacter] = useState<CharacterLock | null>(null);
  const [styleReferenceIndex, setStyleReferenceIndex] = useState<number | null>(null);
  const [styleStrength, setStyleStrength] = useState<number>(() => {
    const savedStrength = localStorage.getItem('ai-pose-animator-styleStrength');
    return savedStrength ? parseInt(savedStrength, 10) : 80;
  });

  const [editMode, setEditMode] = useState<EditMode>(() => {
    const savedMode = localStorage.getItem('ai-pose-animator-editMode') as EditMode | null;
    return savedMode || 'pose';
  });

  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    const savedRatio = localStorage.getItem('ai-pose-animator-aspectRatio');
    return savedRatio || '1:1';
  });
  const [customAspectRatio, setCustomAspectRatio] = useState<string>('');

  const [numberOfVariations, setNumberOfVariations] = useState<number>(1);

  const [promptTemplates, setPromptTemplates] = useState<string[]>(() => {
    try {
        const savedTemplates = localStorage.getItem('ai-pose-animator-promptTemplates');
        return savedTemplates ? JSON.parse(savedTemplates) : [];
    } catch (e) {
        console.error("Failed to load prompt templates from localStorage", e);
        return [];
    }
  });

  const [promptHistory, setPromptHistory] = useState<string[]>(() => {
    try {
        const savedHistory = localStorage.getItem('ai-pose-animator-promptHistory');
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
        console.error("Failed to load prompt history from localStorage", e);
        return [];
    }
  });

  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>(() => {
    try {
        const savedHistory = localStorage.getItem('ai-pose-animator-generationHistory');
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
        console.error("Failed to load generation history from localStorage", e);
        return [];
    }
  });
  
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [selectedHistoryImageSrc, setSelectedHistoryImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Sync custom aspect ratio input field when aspectRatio state changes (e.g., on project load)
  useEffect(() => {
    if (aspectRatio !== 'original' && !PREDEFINED_ASPECT_RATIOS.includes(aspectRatio)) {
        setCustomAspectRatio(aspectRatio);
    } else {
        setCustomAspectRatio('');
    }
  }, [aspectRatio]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai-pose-animator-editMode', editMode);
  }, [editMode]);

  useEffect(() => {
    if (aspectRatio !== 'original') {
        localStorage.setItem('ai-pose-animator-aspectRatio', aspectRatio);
    }
  }, [aspectRatio]);

  useEffect(() => {
    localStorage.setItem('ai-pose-animator-styleStrength', styleStrength.toString());
  }, [styleStrength]);

  useEffect(() => {
    try {
        localStorage.setItem('ai-pose-animator-promptTemplates', JSON.stringify(promptTemplates));
    } catch (e) {
        console.error("Failed to save prompt templates to localStorage", e);
    }
  }, [promptTemplates]);
  
  useEffect(() => {
    try {
        localStorage.setItem('ai-pose-animator-promptHistory', JSON.stringify(promptHistory));
    } catch (e) {
        console.error("Failed to save prompt history from localStorage", e);
    }
  }, [promptHistory]);

  useEffect(() => {
    try {
        localStorage.setItem('ai-pose-animator-generationHistory', JSON.stringify(generationHistory));
    } catch (e) {
        console.error("Failed to save generation history from localStorage", e);
    }
  }, [generationHistory]);

  const handleImageUpload = useCallback((images: (string | null)[]) => {
    const previouslyHadImages = uploadedImages.some(img => img !== null);
    const nowHasImages = images.some(img => img !== null);

    if (lockedCharacter !== null && images[lockedCharacter.index] === null) {
        setLockedCharacter(null);
    }
    if (styleReferenceIndex !== null && images[styleReferenceIndex] === null) {
        setStyleReferenceIndex(null);
    }

    setUploadedImages(images);
    setMaskImage(null); // Clear mask if images change

    if (!previouslyHadImages && nowHasImages) {
      setAspectRatio('original');
    } 
    else if (previouslyHadImages && !nowHasImages && aspectRatio === 'original') {
      setAspectRatio('1:1');
    }
  }, [uploadedImages, aspectRatio, lockedCharacter, styleReferenceIndex]);

  const handleCanvasUpdate = useCallback((dataUrl: string | null) => {
    setCanvasImage(dataUrl);
  }, []);

  const handlePromptChange = useCallback((text: string) => {
    setPrompt(text);
  }, []);
  
  const handleNegativePromptChange = useCallback((text: string) => {
    setNegativePrompt(text);
  }, []);

  const handleUseAsInput = useCallback((image: string, slotIndex: number) => {
    setUploadedImages(prevImages => {
      const newImages = [...prevImages];
      if (slotIndex >= 0 && slotIndex < 3) {
        newImages[slotIndex] = image;
      }
      return newImages;
    });
    setMaskImage(null); // Clear mask if images change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectFromHistory = (result: GenerationResult) => {
    setResults([result]);
    setSelectedHistoryImageSrc(result.image);
  };
  
  const handleDeleteFromHistory = useCallback((resultToDelete: GenerationResult) => {
    setGenerationHistory(prev => prev.filter(result => result.image !== resultToDelete.image));
    if (results.length === 1 && results[0].image === resultToDelete.image) {
      setResults([]);
      setSelectedHistoryImageSrc(null);
    }
  }, [results]);

  const handleClearHistory = useCallback(() => {
    setGenerationHistory([]);
    setResults([]);
    setSelectedHistoryImageSrc(null);
  }, []);

  const handleClearPromptHistory = useCallback(() => {
    setPromptHistory([]);
  }, []);

  const handleZoomImage = useCallback((url: string) => {
    setZoomedImage(url);
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
  
  const handleUpdatePromptTemplate = useCallback((index: number, newText: string) => {
    const trimmedText = newText.trim();
    if (!trimmedText) return;
    
    setPromptTemplates(prev => {
      const newTemplates = [...prev];
      if (newTemplates.some((t, i) => i !== index && t === trimmedText)) {
        console.warn("Template already exists.");
        return prev;
      }
      newTemplates[index] = trimmedText;
      return newTemplates;
    });
  }, []);

  const handleSetCharacterLock = useCallback((index: number, lock: { appearance: boolean; clothing: boolean; }) => {
    if (lock.appearance || lock.clothing) {
      setLockedCharacter({ index, lockAppearance: lock.appearance, lockClothing: lock.clothing });
    } else {
      setLockedCharacter(null);
    }
  }, []);

  const handleToggleStyleReference = useCallback((index: number) => {
    setStyleReferenceIndex(prev => (prev === index ? null : index));
  }, []);

  const handleAnalyzePose = async (image: string) => {
    const imageIndex = uploadedImages.findIndex(img => img === image);
    setIsAnalyzing(imageIndex);
    setError(null);
    setResults([]);
    try {
        const keypoints = await analyzePose(image);
        setPoseKeypoints(keypoints);
        setPoseSourceImage(image);
        setCanvasImage(null); // Clear any hand-drawn canvas
        setMaskImage(null); // Clear any mask
        setEditMode('pose'); // Switch to pose mode automatically
    } catch (err: any) {
        setError(err.message || "An unknown error occurred during pose analysis.");
    } finally {
        setIsAnalyzing(null);
    }
  };

  const handleStartMasking = useCallback((image: string, index: number) => {
    setMaskingImage({ src: image, index });
  }, []);

  const handleMaskComplete = useCallback((maskDataUrl: string) => {
    setMaskImage(maskDataUrl);
    setMaskingImage(null);
    setPoseKeypoints(null); // Clear pose if we are now masking
    setPoseSourceImage(null);
    setEditMode('prompt'); // Switch to prompt mode automatically
  }, []);

  const handleGenerate = async () => {
    const validImages = uploadedImages.filter((img): img is string => img !== null);
    const hasPrompt = prompt.trim().length > 0;

    if (hasPrompt) {
        const trimmedPrompt = prompt.trim();
        setPromptHistory(prev => {
            const newHistory = [trimmedPrompt, ...prev.filter(p => p !== trimmedPrompt)];
            return newHistory.slice(0, 50); // Limit to 50 prompts
        });
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setSelectedHistoryImageSrc(null);

    try {
      let generatedResults: GenerationResult[];
      let finalAspectRatio: string;
      
      if (aspectRatio === 'original') {
        finalAspectRatio = validImages.length > 0 ? await getAspectRatioFromDataUrl(validImages[0]) : '1:1';
      } else if (customAspectRatio && !PREDEFINED_ASPECT_RATIOS.includes(aspectRatio)) {
        finalAspectRatio = aspectRatio;
      } else {
        finalAspectRatio = aspectRatio;
      }


      const variationText = numberOfVariations > 1 ? ` ${numberOfVariations} 張圖片` : `圖片`;
      
      // CASE 1: Masking mode (inpainting)
      if (editMode === 'prompt' && hasPrompt && validImages[0] && maskImage) {
        setLoadingMessage(`根據提示詞進行修補，以建立${variationText}...`);
        generatedResults = await editImageWithMask(validImages[0], maskImage, prompt, negativePrompt, finalAspectRatio, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength);
      }
      // CASE 2: Prompt mode with NO images (Text-to-Image)
      else if (editMode === 'prompt' && hasPrompt && validImages.length === 0) {
        setLoadingMessage(`根據提示詞建立${variationText}...`);
        generatedResults = await generateImageFromPrompt(prompt, negativePrompt, finalAspectRatio, numberOfVariations);
      } 
      // CASE 3: Pose mode (requires images and pose)
      else if (editMode === 'pose' && canvasImage && validImages.length > 0) {
        setLoadingMessage(`根據姿勢生成${variationText}...`);
        generatedResults = await generateImageFromPose(validImages, canvasImage, negativePrompt, finalAspectRatio, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength);
      }
      // CASE 4: Prompt mode WITH images (Image Editing, no mask)
      else if (editMode === 'prompt' && hasPrompt && validImages.length > 0) {
        setLoadingMessage(`根據提示詞編輯圖片，以建立${variationText}...`);
        generatedResults = await editImageWithPrompt(validImages, prompt, negativePrompt, finalAspectRatio, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength);
      }
      // CASE 5: Invalid state
      else {
          let errorMessage = "請檢查您的輸入。";
          if (validImages.length === 0 && (editMode === 'pose' || (editMode === 'prompt' && !hasPrompt))) errorMessage += "需要輸入圖片。";
          if (editMode === 'pose' && !canvasImage) errorMessage += "需要繪製姿勢。";
          if (editMode === 'prompt' && !hasPrompt) errorMessage += "需要文字提示詞。";
          throw new Error(errorMessage.trim());
      }
      
      setResults(generatedResults);
      setGenerationHistory(prev => [...generatedResults, ...prev].slice(0, 10));

    } catch (err: any) {
      setError(err.message || "發生未知錯誤。");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleExportProject = () => {
    try {
        const projectData = {
            version: APP_VERSION,
            uploadedImages,
            canvasImage,
            prompt,
            negativePrompt,
            poseKeypoints,
            poseSourceImage,
            maskImage,
            lockedCharacter,
            styleReferenceIndex,
            styleStrength,
            editMode,
            aspectRatio,
            numberOfVariations,
            promptTemplates,
            promptHistory,
            generationHistory,
        };
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ultra-nano-banana-project.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export project:', error);
        setError('匯出專案時發生錯誤。');
    }
  };

  const handleImportProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('專案檔是空的。');
        }
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error('無法解析專案檔。請確認檔案格式為有效的 JSON。');
        }

        // --- Validation Start ---
        if (!data || typeof data !== 'object' || !data.version || typeof data.version !== 'string') {
          throw new Error('無效的專案檔。檔案可能已損壞或缺少必要的版本資訊。');
        }

        const fileVersionString = data.version;
        const fileMajorVersion = parseInt(fileVersionString.split('.')[0], 10);
        const appMajorVersion = parseInt(APP_VERSION.split('.')[0], 10);
        
        if (isNaN(fileMajorVersion) || fileMajorVersion > appMajorVersion) {
            throw new Error(`不支援的專案版本。此檔案是由較新版本的應用程式 (${fileVersionString}) 建立的。`);
        }
        // --- Validation End ---
        
        setError(null); // Clear previous errors on successful load

        // Load project data with defaults for backward compatibility
        setUploadedImages(data.uploadedImages || [null, null, null]);
        setCanvasImage(data.canvasImage || null);
        setPrompt(data.prompt || '');
        setNegativePrompt(data.negativePrompt || '');
        setPoseKeypoints(data.poseKeypoints || null);
        setPoseSourceImage(data.poseSourceImage || null);
        setMaskImage(data.maskImage || null);
        
        if (data.lockedCharacter) {
          setLockedCharacter(data.lockedCharacter);
        } else if (data.lockedCharacterIndex !== null && data.lockedCharacterIndex !== undefined) {
          // Backward compatibility for old 'lockedCharacterIndex'
          setLockedCharacter({
            index: data.lockedCharacterIndex,
            lockAppearance: true,
            lockClothing: true,
          });
        } else {
          setLockedCharacter(null);
        }

        setStyleReferenceIndex(data.styleReferenceIndex || null);
        setStyleStrength(data.styleStrength ?? 80);
        setEditMode(data.editMode || 'pose');
        setAspectRatio(data.aspectRatio || '1:1');
        setNumberOfVariations(data.numberOfVariations || 1);
        setPromptTemplates(data.promptTemplates || []);
        setPromptHistory(data.promptHistory || []);
        setGenerationHistory(data.generationHistory || []);

        setResults([]); 
        setSelectedHistoryImageSrc(null);
        alert('專案已成功匯入！');

      } catch (err: any) {
        const errorMessage = err.message || '匯入專案時發生未知錯誤。';
        console.error('Failed to import project:', err);
        setError(errorMessage);
      } finally {
        // Ensure input is cleared to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
      }
    };

    reader.onerror = () => {
      setError('讀取檔案時發生錯誤。');
      console.error('Error reading file for import.');
       if (event.target) {
            event.target.value = '';
        }
    };

    reader.readAsText(file);
  };

  const handlePresetAspectRatioSelect = (newRatio: string) => {
      setAspectRatio(newRatio);
      setCustomAspectRatio('');
  };

  const handleCustomAspectRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomAspectRatio(value);

      const ratioRegex = /^\s*(\d+(\.\d+)?)\s*[:/]\s*(\d+(\.\d+)?)\s*$/;
      const match = value.match(ratioRegex);

      if (match) {
          const w = parseFloat(match[1]);
          const h = parseFloat(match[3]);
          if (w > 0 && h > 0) {
              setAspectRatio(`${w}:${h}`);
          }
      }
  };
  
  const handleCustomAspectRatioBlur = () => {
    // If user leaves custom input but it's not a valid format,
    // and the current aspect ratio is not a preset, reset to '1:1'
    const isValidCustom = aspectRatio === customAspectRatio && customAspectRatio !== '';
    if (!PREDEFINED_ASPECT_RATIOS.includes(aspectRatio) && aspectRatio !== 'original' && !isValidCustom) {
      if (!customAspectRatio) {
          // If the box is cleared, revert to a safe default
          setAspectRatio('1:1');
      }
      // If it's invalid text, just leave it, handleCustomAspectRatioChange has already stopped updating the real aspectRatio state
    }
  };

  const hasImages = uploadedImages.some(img => img !== null);
  const hasPrompt = prompt.trim().length > 0;
  const hasPose = !!canvasImage;

  let isGenerateDisabled = isLoading || !!isAnalyzing || !!maskingImage;
  if (!isGenerateDisabled) {
      if (editMode === 'pose') {
          isGenerateDisabled = !hasImages || !hasPose;
      } else if (editMode === 'prompt') {
          isGenerateDisabled = !hasPrompt;
      }
  }

  const isOriginalDisabled = !hasImages;
  const uploadedImageCount = uploadedImages.filter(Boolean).length;
  const generateButtonText = isLoading ? (loadingMessage || '生成中...') : (editMode === 'prompt' && !hasImages) ? '✨ 創造圖片' : '✨ 生成圖片';
  
  const parseAspectRatio = (ratio: string): number | undefined => {
    if (ratio === 'original' || !ratio.includes(':')) return undefined;
    const parts = ratio.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[0] <= 0 || parts[1] <= 0) {
      return undefined;
    }
    return parts[0] / parts[1];
  };

  const isCustomRatioActive = aspectRatio !== 'original' && !PREDEFINED_ASPECT_RATIOS.includes(aspectRatio);

  const AspectRatioButton: React.FC<{ value: string; label: string; disabled?: boolean }> = ({ value, label, disabled }) => (
    <button onClick={() => !disabled && handlePresetAspectRatioSelect(value)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${!disabled && aspectRatio === value ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} aria-pressed={aspectRatio === value} disabled={disabled} >
      {label}
    </button>
  );

  const VariationButton: React.FC<{ value: number }> = ({ value }) => (
    <button onClick={() => setNumberOfVariations(value)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${numberOfVariations === value ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'}`} aria-pressed={numberOfVariations === value} >
      {value}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          Ultra Nano Banana 應用程式
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          上傳照片、繪製遮罩、畫出姿勢或描述編輯，讓 AI 將您的想像變為現實！
        </p>
      </header>
      
      <main className="w-full flex flex-col items-center">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader 
            onImageUpload={handleImageUpload} 
            images={uploadedImages}
            cropAspectRatio={parseAspectRatio(aspectRatio)}
            onAnalyzePose={handleAnalyzePose}
            analyzingIndex={isAnalyzing}
            onStartMasking={handleStartMasking}
            maskingImageIndex={maskingImage?.index ?? null}
            lockedCharacter={lockedCharacter}
            onSetCharacterLock={handleSetCharacterLock}
            styleReferenceIndex={styleReferenceIndex}
            onToggleStyleReference={handleToggleStyleReference}
          />
          <div className="flex flex-col w-full h-full">
            <div className="flex justify-center mb-4 gap-2 p-1 bg-slate-700 rounded-lg">
                <button onClick={() => setEditMode('pose')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${editMode === 'pose' ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'}`} aria-pressed={editMode === 'pose'}>
                    繪製或編輯姿勢
                </button>
                <button onClick={() => setEditMode('prompt')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${editMode === 'prompt' ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'}`} aria-pressed={editMode === 'prompt'}>
                    使用提示詞編輯
                </button>
            </div>
            {editMode === 'pose' ? (
                poseKeypoints ? (
                    <PoseEditor 
                        initialPose={poseKeypoints}
                        backgroundImage={poseSourceImage}
                        onCanvasUpdate={handleCanvasUpdate}
                        onClear={() => {
                            setPoseKeypoints(null);
                            setCanvasImage(null);
                            setPoseSourceImage(null);
                        }}
                    />
                ) : (
                    <DrawingCanvas onCanvasUpdate={handleCanvasUpdate} clearTrigger={clearCanvasTrigger} />
                )
            ) : (
                <PromptEditor 
                    prompt={prompt} 
                    onPromptChange={handlePromptChange} 
                    negativePrompt={negativePrompt}
                    onNegativePromptChange={handleNegativePromptChange}
                    templates={promptTemplates}
                    onSaveTemplate={handleSavePromptTemplate}
                    onDeleteTemplate={handleDeletePromptTemplate}
                    onUpdateTemplate={handleUpdatePromptTemplate}
                    uploadedImageCount={uploadedImageCount}
                    promptHistory={promptHistory}
                    onClearPromptHistory={handleClearPromptHistory}
                />
            )}
          </div>
        </div>

        <div className="my-6 text-center w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">3. 選擇長寬比</h3>
                <div className="p-2 bg-slate-700 rounded-lg">
                    <div className="grid grid-cols-3 gap-2">
                        {PREDEFINED_ASPECT_RATIOS.slice(0, 3).map(r => <AspectRatioButton key={r} value={r} label={r} />)}
                        {PREDEFINED_ASPECT_RATIOS.slice(3).map(r => <AspectRatioButton key={r} value={r} label={r} />)}
                         <AspectRatioButton value="original" label="原始比例" disabled={isOriginalDisabled} />
                    </div>
                    <div className="mt-2 grid grid-cols-1">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="自訂 (例如: 21:9)"
                                value={customAspectRatio}
                                onChange={handleCustomAspectRatioChange}
                                onBlur={handleCustomAspectRatioBlur}
                                className={`w-full h-full text-center px-2 py-2 text-sm font-medium rounded-md transition-colors bg-slate-800 text-slate-300 placeholder-slate-500 border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-sky-500 ${isCustomRatioActive ? 'border-sky-600 bg-sky-900/50 text-white' : 'border-transparent hover:bg-slate-600'}`}
                            />
                        </div>
                    </div>
                </div>
            </div>
             <div>
                <h3 className="text-xl font-semibold text-white mb-3">4. 生成數量</h3>
                <div className="grid grid-cols-4 gap-2 p-1 bg-slate-700 rounded-lg">
                    <VariationButton value={1} />
                    <VariationButton value={2} />
                    <VariationButton value={3} />
                    <VariationButton value={4} />
                </div>
            </div>
             <div className={styleReferenceIndex === null ? 'opacity-50' : ''}>
                <h3 className="text-xl font-semibold text-white mb-3">風格強度</h3>
                <div 
                    className="p-1 bg-slate-700 rounded-lg flex flex-col items-center justify-center h-full px-4 py-2"
                    title={styleReferenceIndex === null ? '請先在上方選擇一個風格參考' : '調整風格參考的影響程度'}
                >
                    <input
                        id="style-strength-slider"
                        type="range" min="10" max="100" step="5"
                        value={styleStrength}
                        onChange={(e) => setStyleStrength(Number(e.target.value))}
                        disabled={styleReferenceIndex === null}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <label htmlFor="style-strength-slider" className="text-white mt-2 font-mono text-sm">{styleStrength}%</label>
                </div>
            </div>
        </div>
        
        <div className="my-6 flex flex-col items-center gap-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className={`px-10 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${isLoading || isAnalyzing ? 'animate-pulse' : ''}`}
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
            activeImageSrc={selectedHistoryImageSrc}
        />

        <GeneratedResult
          results={results}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          error={error}
          onUseAsInput={handleUseAsInput}
          onZoom={handleZoomImage}
        />
        
        {maskingImage && (
            <MaskEditor 
                src={maskingImage.src}
                onClose={() => setMaskingImage(null)}
                onMaskComplete={handleMaskComplete}
            />
        )}
        {zoomedImage && <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      </main>

      <footer className="mt-12 text-center text-slate-500 text-sm space-y-4">
        <SettingsManager onExportProject={handleExportProject} onImportProject={handleImportProject} />
        <p>由 Google Gemini 提供技術支援。使用 React 和 Tailwind CSS 建構。</p>
      </footer>
    </div>
  );
};

export default App;