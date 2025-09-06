import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import PromptEditor from './components/PromptEditor';
import GeneratedResult from './components/GeneratedImage';
import HistoryPanel from './components/HistoryPanel';
import ImageModal from './components/ImageModal';
import SettingsManager from './components/SettingsManager';
import ChatEditor from './components/ChatEditor';
import GenerativeCanvas from './components/GenerativeCanvas';
import StyleAnalyzerResultModal from './components/StyleAnalyzerResultModal';
import BatchProcessModal from './components/BatchProcessModal';
import ControlLayersManager from './components/ControlLayers';
import { 
    generateImageWithControls,
    editImageWithPrompt, 
    generateImageFromPrompt, 
    analyzePose, 
    editImageWithMask, 
    editImageWithChat, 
    analyzeStyle, 
    generateCannyEdgeMap,
    generateDepthMap
} from './services/geminiService';
import type { GenerationResult, Pose, ChatMessage, ControlLayers, WorkflowPreset } from './types';

type CharacterLock = { index: number; lockAppearance: boolean; lockClothing: boolean; };
type EditingState = { 
  isActive: boolean; 
  imageSrc: string | null; 
  // For data coming back from the canvas
  editImage?: string; 
  editMask?: string; 
  editAspectRatio?: string;
};

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
const APP_VERSION = '1.7.0';

const defaultControlLayer = { image: null, weight: 100 };
const initialControlLayers = {
    pose: defaultControlLayer,
    canny: defaultControlLayer,
    depth: defaultControlLayer,
    scribble: defaultControlLayer,
};


const App: React.FC = () => {
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  const [prompt, setPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [poseKeypoints, setPoseKeypoints] = useState<Pose | null>(null);
  const [poseSourceImage, setPoseSourceImage] = useState<string | null>(null);
  
  const [controlLayers, setControlLayers] = useState<ControlLayers>(initialControlLayers);
  const [editingState, setEditingState] = useState<EditingState>({ isActive: false, imageSrc: null });
  
  const [lockedCharacter, setLockedCharacter] = useState<CharacterLock | null>(null);
  const [styleReferenceIndex, setStyleReferenceIndex] = useState<number | null>(null);
  const [styleStrength, setStyleStrength] = useState<number>(() => {
    const savedStrength = localStorage.getItem('ai-app-styleStrength');
    return savedStrength ? parseInt(savedStrength, 10) : 80;
  });
  
  const [seed, setSeed] = useState<string>('');
  const [isSeedLocked, setIsSeedLocked] = useState(false);

  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    const savedRatio = localStorage.getItem('ai-app-aspectRatio');
    return savedRatio || '1:1';
  });
  const [customAspectRatio, setCustomAspectRatio] = useState<string>('');
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);

  const [numberOfVariations, setNumberOfVariations] = useState<number>(1);

  const [promptTemplates, setPromptTemplates] = useState<string[]>(() => {
    try {
        const savedTemplates = localStorage.getItem('ai-app-promptTemplates');
        return savedTemplates ? JSON.parse(savedTemplates) : [];
    } catch (e) { return []; }
  });

  const [promptHistory, setPromptHistory] = useState<string[]>(() => {
    try {
        const savedHistory = localStorage.getItem('ai-app-promptHistory');
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) { return []; }
  });

  const [generationHistory, setGenerationHistory] = useState<GenerationResult[]>(() => {
    try {
        const savedHistory = localStorage.getItem('ai-app-generationHistory');
        return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) { return []; }
  });

  const [workflowPresets, setWorkflowPresets] = useState<WorkflowPreset[]>(() => {
    try {
        const savedPresets = localStorage.getItem('ai-app-workflowPresets');
        return savedPresets ? JSON.parse(savedPresets) : [];
    } catch (e) { return []; }
  });
  
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [selectedHistoryImageSrc, setSelectedHistoryImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzingPose, setIsAnalyzingPose] = useState<number | null>(null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState<number | null>(null);
  const [generatingControlMap, setGeneratingControlMap] = useState<{ index: number; type: 'canny' | 'depth' } | null>(null);
  const [analyzedStyleResult, setAnalyzedStyleResult] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Batch Processing State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchPrompts, setBatchPrompts] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<GenerationResult[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  // Sync custom aspect ratio input field
  useEffect(() => {
    if (aspectRatio !== 'original' && !PREDEFINED_ASPECT_RATIOS.includes(aspectRatio)) {
        setCustomAspectRatio(aspectRatio);
    } else {
        setCustomAspectRatio('');
    }
  }, [aspectRatio]);

  // Save settings to localStorage
  useEffect(() => { localStorage.setItem('ai-app-aspectRatio', aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem('ai-app-styleStrength', styleStrength.toString()); }, [styleStrength]);
  useEffect(() => { localStorage.setItem('ai-app-promptTemplates', JSON.stringify(promptTemplates)); }, [promptTemplates]);
  useEffect(() => { localStorage.setItem('ai-app-promptHistory', JSON.stringify(promptHistory)); }, [promptHistory]);
  useEffect(() => { localStorage.setItem('ai-app-generationHistory', JSON.stringify(generationHistory)); }, [generationHistory]);
  useEffect(() => { localStorage.setItem('ai-app-workflowPresets', JSON.stringify(workflowPresets)); }, [workflowPresets]);


  const handleImageUpload = useCallback((images: (string | null)[]) => {
    if (lockedCharacter !== null && images[lockedCharacter.index] === null) setLockedCharacter(null);
    if (styleReferenceIndex !== null && images[styleReferenceIndex] === null) setStyleReferenceIndex(null);
    setUploadedImages(images);
    const hadImages = uploadedImages.some(img => img);
    const hasImages = images.some(img => img);
    if (!hadImages && hasImages) setAspectRatio('original');
    else if (hadImages && !hasImages && aspectRatio === 'original') setAspectRatio('1:1');
  }, [uploadedImages, aspectRatio, lockedCharacter, styleReferenceIndex]);

  const handleLayersUpdate = useCallback((layers: ControlLayers) => { setControlLayers(layers); }, []);
  const handlePromptChange = useCallback((text: string) => { setPrompt(text); }, []);
  const handleNegativePromptChange = useCallback((text: string) => { setNegativePrompt(text); }, []);

  const handleUseAsInput = useCallback((image: string, slotIndex: number) => {
    setUploadedImages(prevImages => {
      const newImages = [...prevImages];
      if (slotIndex >= 0 && slotIndex < 3) newImages[slotIndex] = image;
      return newImages;
    });
    setChatHistory([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectFromHistory = (result: GenerationResult) => {
    setResults([result]);
    setSelectedHistoryImageSrc(result.image);
    setSeed(String(result.seed || ''));
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
    setChatHistory([]);
  }, []);

  const handleClearPromptHistory = useCallback(() => { setPromptHistory([]); }, []);
  const handleZoomImage = useCallback((url: string) => { setZoomedImage(url); }, []);

  const handleSavePromptTemplate = useCallback((template: string) => {
    const trimmed = template.trim();
    if (trimmed && !promptTemplates.includes(trimmed)) {
        setPromptTemplates(prev => [trimmed, ...prev].slice(0, 20));
    }
  }, [promptTemplates]);

  const handleDeletePromptTemplate = useCallback((template: string) => {
    setPromptTemplates(prev => prev.filter(t => t !== template));
  }, []);
  
  const handleUpdatePromptTemplate = useCallback((index: number, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setPromptTemplates(prev => {
      const newTemplates = [...prev];
      if (newTemplates.some((t, i) => i !== index && t === trimmed)) return prev;
      newTemplates[index] = trimmed;
      return newTemplates;
    });
  }, []);

  const handleSetCharacterLock = useCallback((index: number, lock: { appearance: boolean; clothing: boolean; }) => {
    if (lock.appearance || lock.clothing) setLockedCharacter({ index, lockAppearance: lock.appearance, lockClothing: lock.clothing });
    else setLockedCharacter(null);
  }, []);

  const handleToggleStyleReference = useCallback((index: number) => {
    setStyleReferenceIndex(prev => (prev === index ? null : index));
  }, []);

  const handleAnalyzePose = async (image: string) => {
    const imageIndex = uploadedImages.findIndex(img => img === image);
    setIsAnalyzingPose(imageIndex);
    setError(null);
    setResults([]);
    setChatHistory([]);
    try {
        const keypoints = await analyzePose(image);
        setPoseKeypoints(keypoints);
        setPoseSourceImage(image);
        setControlLayers(prev => ({ ...prev, pose: { image: null, weight: 100 }, scribble: prev.scribble }));
    } catch (err: any) {
        setError(err.message || "姿勢分析時發生未知錯誤。");
    } finally {
        setIsAnalyzingPose(null);
    }
  };

  const handleAnalyzeStyle = async (index: number) => {
    const image = uploadedImages[index];
    if (!image) return;
    setIsAnalyzingStyle(index);
    setError(null);
    setResults([]);
    try {
        const styleText = await analyzeStyle(image);
        setAnalyzedStyleResult(styleText);
    } catch (err: any) {
        setError(err.message || "風格分析時發生未知錯誤。");
    } finally {
        setIsAnalyzingStyle(null);
    }
  };

  const handleGenerateControlMap = async (index: number, type: 'canny' | 'depth') => {
    const image = uploadedImages[index];
    if (!image) return;
    setGeneratingControlMap({ index, type });
    setError(null);
    setResults([]);
    try {
        const service = type === 'canny' ? generateCannyEdgeMap : generateDepthMap;
        const result = await service(image);
        if (result.image) {
            setControlLayers(prev => ({ ...prev, [type]: { image: result.image, weight: 100 } }));
        } else { throw new Error('API 未返回控制圖。'); }
    } catch (err: any) {
        setError(err.message || `生成 ${type} 圖時失敗。`);
    } finally {
        setGeneratingControlMap(null);
    }
  };
  
  const handleStartEditing = (imageSrc: string) => {
      setEditingState({ isActive: true, imageSrc });
  };
  const handleCloseEditor = () => {
      setEditingState({ isActive: false, imageSrc: null });
  };
  const handleEditConfirm = (editData: { image: string, mask: string, aspectRatio: string }) => {
      const stateUpdate = {
          isActive: true, // Keep it active to indicate we are generating from an edit
          imageSrc: editingState.imageSrc,
          editImage: editData.image,
          editMask: editData.mask,
          editAspectRatio: editData.aspectRatio
      };
      setEditingState(stateUpdate);
      handleGenerate(stateUpdate);
  };
  

  const handleChatEdit = async (chatPrompt: string) => {
    setIsChatLoading(true);
    setError(null);
    setChatHistory(prev => [...prev, { role: 'user', text: chatPrompt }]);
    try {
        const currentSeed = isSeedLocked && seed ? parseInt(seed, 10) : null;
        const validImages = uploadedImages.filter((img): img is string => img !== null);
        const finalAspectRatio = aspectRatio === 'original' && validImages.length > 0 ? await getAspectRatioFromDataUrl(validImages[0]) : (customAspectRatio || aspectRatio);
        const result = await editImageWithChat(chatHistory, chatPrompt, negativePrompt, finalAspectRatio, lockedCharacter, styleReferenceIndex, styleStrength, useGoogleSearch, currentSeed);
        setResults([result]);
        setChatHistory(prev => [...prev, { role: 'model', image: result.image! }]);
        setGenerationHistory(prev => [result, ...prev].slice(0, 10));
        if (result.seed && !isSeedLocked) setSeed(String(result.seed));
    } catch (err: any) {
        setError(err.message || "發生未知錯誤。");
    } finally {
        setIsChatLoading(false);
    }
  };


  const handleGenerate = async (currentEditingState: EditingState = editingState) => {
    const validImages = uploadedImages.filter((img): img is string => img !== null);
    const hasPrompt = prompt.trim().length > 0;
    const hasActiveControl = Object.values(controlLayers).some(l => l.image);

    if (hasPrompt) {
        const trimmed = prompt.trim();
        setPromptHistory(prev => [trimmed, ...prev.filter(p => p !== trimmed)].slice(0, 50));
    }

    setIsLoading(true);
    setError(null);
    if (!currentEditingState.isActive) {
      setResults([]);
      setSelectedHistoryImageSrc(null);
      setChatHistory([]);
    }

    try {
        let generatedResults: GenerationResult[];
        const currentSeed = (isSeedLocked && seed) ? parseInt(seed, 10) : null;
        const variationText = numberOfVariations > 1 ? `${numberOfVariations} 張圖片` : `圖片`;

        // CASE 1: Editing mode (Inpainting/Outpainting)
        if (currentEditingState.isActive && currentEditingState.editImage && currentEditingState.editMask) {
            setLoadingMessage(`根據編輯區域生成${variationText}...`);
            generatedResults = await editImageWithMask(currentEditingState.editImage, currentEditingState.editMask, prompt, negativePrompt, currentEditingState.editAspectRatio!, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength, useGoogleSearch, currentSeed);
        }
        // CASE 2: Control Layers mode
        else if (hasActiveControl) {
            setLoadingMessage(`根據控制圖層生成${variationText}...`);
            const finalAspectRatio = aspectRatio === 'original' && validImages.length > 0 ? await getAspectRatioFromDataUrl(validImages[0]) : (customAspectRatio || aspectRatio);
            generatedResults = await generateImageWithControls(validImages, prompt, negativePrompt, controlLayers, finalAspectRatio, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength, useGoogleSearch, currentSeed);
        }
        // CASE 3: Text-to-Image mode
        else if (hasPrompt && validImages.length === 0) {
            setLoadingMessage(`根據提示詞建立${variationText}...`);
            const finalAspectRatio = customAspectRatio || aspectRatio;
            generatedResults = await generateImageFromPrompt(prompt, negativePrompt, finalAspectRatio, numberOfVariations, useGoogleSearch, currentSeed);
        }
        // CASE 4: Image-to-Image mode
        else if (hasPrompt && validImages.length > 0) {
            setLoadingMessage(`根據提示詞編輯圖片，以建立${variationText}...`);
            const finalAspectRatio = aspectRatio === 'original' ? await getAspectRatioFromDataUrl(validImages[0]) : (customAspectRatio || aspectRatio);
            generatedResults = await editImageWithPrompt(validImages, prompt, negativePrompt, finalAspectRatio, numberOfVariations, lockedCharacter, styleReferenceIndex, styleStrength, useGoogleSearch, currentSeed);
        }
        // CASE 5: Invalid state
        else {
            throw new Error("請檢查您的輸入。需要提示詞，或控制圖層與輸入圖片。");
        }

        if (currentEditingState.isActive) {
            const originalSrc = currentEditingState.imageSrc;
            setResults(prev => prev.map(r => r.image === originalSrc ? generatedResults[0] : r));
        } else {
            setResults(generatedResults);
        }
        
        setGenerationHistory(prev => [...generatedResults, ...prev].slice(0, 10));
        if (generatedResults[0]?.seed && !isSeedLocked) setSeed(String(generatedResults[0].seed));

        if (generatedResults.length === 1 && generatedResults[0].image && !currentEditingState.isActive) {
            const initialChat: ChatMessage[] = [];
            const userMessage: ChatMessage = { role: 'user', text: prompt };
            if (validImages.length > 0) userMessage.image = validImages[0];
            initialChat.push(userMessage);
            initialChat.push({ role: 'model', image: generatedResults[0].image });
            setChatHistory(initialChat);
        }
    } catch (err: any) {
        setError(err.message || "發生未知錯誤。");
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
        setEditingState({ isActive: false, imageSrc: null });
    }
  };

  const handleStartBatch = async (promptsToProcess: string[]) => {
    setBatchPrompts(promptsToProcess);
    setBatchResults([]);
    setCurrentBatchIndex(0);
    setIsBatchRunning(true);
  
    const validImages = uploadedImages.filter((img): img is string => img !== null);
    
    for (let i = 0; i < promptsToProcess.length; i++) {
        setCurrentBatchIndex(i);
        const currentPrompt = promptsToProcess[i];
        
        if (promptHistory.every(p => p !== currentPrompt)) {
            setPromptHistory(prev => [currentPrompt, ...prev].slice(0, 50));
        }

        try {
            const finalAspectRatio = aspectRatio === 'original' && validImages.length > 0 ? await getAspectRatioFromDataUrl(validImages[0]) : (customAspectRatio || aspectRatio);
            const seedForBatch = isSeedLocked && seed ? parseInt(seed, 10) + i : null; // Increment seed for variety

            const generatedResults = await editImageWithPrompt(
                validImages, currentPrompt, negativePrompt, finalAspectRatio, 1,
                lockedCharacter, styleReferenceIndex, styleStrength, useGoogleSearch, seedForBatch
            );
            setBatchResults(prev => [...prev, ...generatedResults]);
            setGenerationHistory(prev => [...generatedResults, ...prev].slice(0, 50));
        } catch (error) {
            console.error(`Batch generation failed for prompt: "${currentPrompt}"`, error);
        }
    }
    setIsBatchRunning(false);
  };
  
  const handleExportProject = () => {
    try {
        const projectData = {
            version: APP_VERSION, uploadedImages, prompt, negativePrompt,
            poseKeypoints, poseSourceImage, controlLayers, lockedCharacter,
            styleReferenceIndex, styleStrength, aspectRatio, useGoogleSearch,
            numberOfVariations, promptTemplates, seed, isSeedLocked
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
        setError('匯出專案時發生錯誤。');
    }
  };

  const handleImportProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data || typeof data !== 'object') throw new Error('無效的專案檔。');
        
        setError(null);
        setUploadedImages(data.uploadedImages || [null, null, null]);
        setPrompt(data.prompt || '');
        setNegativePrompt(data.negativePrompt || '');
        setPoseKeypoints(data.poseKeypoints || null);
        setPoseSourceImage(data.poseSourceImage || null);
        setControlLayers(data.controlLayers || initialControlLayers);
        setLockedCharacter(data.lockedCharacter || null);
        setStyleReferenceIndex(data.styleReferenceIndex || null);
        setStyleStrength(data.styleStrength ?? 80);
        setAspectRatio(data.aspectRatio || '1:1');
        setUseGoogleSearch(data.useGoogleSearch || false);
        setNumberOfVariations(data.numberOfVariations || 1);
        setPromptTemplates(data.promptTemplates || []);
        setSeed(data.seed || '');
        setIsSeedLocked(data.isSeedLocked || false);
        setResults([]); 
        setSelectedHistoryImageSrc(null);
        setChatHistory([]);
        alert('專案已成功匯入！');
      } catch (err: any) {
        setError(err.message || '匯入專案時發生未知錯誤。');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.onerror = () => setError('讀取檔案時發生錯誤。');
    reader.readAsText(file);
  };

  const handleSavePreset = (name: string) => {
    if (workflowPresets.some(p => p.name === name)) {
      if (!confirm(`已存在名為 "${name}" 的預設集。您要覆蓋它嗎？`)) {
        return;
      }
    }
    const preset: WorkflowPreset = {
      name,
      state: {
        uploadedImages, prompt, negativePrompt, controlLayers, lockedCharacter,
        styleReferenceIndex, styleStrength, aspectRatio, useGoogleSearch,
        numberOfVariations, seed, isSeedLocked
      }
    };
    setWorkflowPresets(prev => [preset, ...prev.filter(p => p.name !== name)]);
    alert(`預設集 "${name}" 已儲存！`);
  };

  const handleLoadPreset = (preset: WorkflowPreset) => {
    const s = preset.state;
    setUploadedImages(s.uploadedImages);
    setPrompt(s.prompt);
    setNegativePrompt(s.negativePrompt);
    setControlLayers(s.controlLayers);
    setLockedCharacter(s.lockedCharacter);
    setStyleReferenceIndex(s.styleReferenceIndex);
    setStyleStrength(s.styleStrength);
    setAspectRatio(s.aspectRatio);
    setUseGoogleSearch(s.useGoogleSearch);
    setNumberOfVariations(s.numberOfVariations);
    setSeed(s.seed);
    setIsSeedLocked(s.isSeedLocked);
    setResults([]); 
    setSelectedHistoryImageSrc(null);
    setChatHistory([]);
    alert(`預設集 "${preset.name}" 已載入！`);
  };

  const handleDeletePreset = (presetName: string) => {
    if (confirm(`您確定要刪除預設集 "${presetName}" 嗎？`)) {
      setWorkflowPresets(prev => prev.filter(p => p.name !== presetName));
    }
  };

  const handleCustomAspectRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomAspectRatio(value);
      if (/^\s*(\d+(\.\d+)?)\s*[:/]\s*(\d+(\.\d+)?)\s*$/.test(value)) {
          setAspectRatio(value.replace(/\s*\/\s*/, ':'));
      }
  };

  const hasImages = uploadedImages.some(img => img !== null);
  const hasPrompt = prompt.trim().length > 0;
  const hasActiveControl = Object.values(controlLayers).some(l => l.image);
  const isBusy = isLoading || !!isAnalyzingPose || !!isAnalyzingStyle || !!generatingControlMap;
  
  let isGenerateDisabled = isBusy || editingState.isActive;
  if (!isGenerateDisabled) {
      if (editingState.isActive) {
          isGenerateDisabled = !hasPrompt;
      } else {
          isGenerateDisabled = !hasPrompt && !hasActiveControl;
      }
  }

  const getGenerateButtonTooltip = (): string => {
      if (isBusy) return '正在處理中...';
      if (isGenerateDisabled) {
          if (!hasPrompt && !hasActiveControl) return '請先輸入提示詞或啟用一個控制圖層。';
      }
      return '';
  };

  const uploadedImageCount = uploadedImages.filter(Boolean).length;
  const generateButtonText = isLoading ? (loadingMessage || '生成中...') : '✨ 生成圖片';
  const parseAspectRatio = (ratio: string) => {
    if (ratio === 'original' || !ratio.includes(':')) return undefined;
    const [w, h] = ratio.split(':').map(Number);
    return (w > 0 && h > 0) ? w / h : undefined;
  };
  const isCustomRatioActive = aspectRatio !== 'original' && !PREDEFINED_ASPECT_RATIOS.includes(aspectRatio);

  const AspectRatioButton: React.FC<{ value: string; label: string; disabled?: boolean }> = ({ value, label, disabled }) => (
    <button onClick={() => !disabled && setAspectRatio(value)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${!disabled && aspectRatio === value ? 'bg-sky-600 text-white shadow' : 'bg-transparent text-slate-300 hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} disabled={disabled} >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          Ultra Nano Banana 應用程式
        </h1>
      </header>
      
      <main className="w-full flex flex-col items-center">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader 
            onImageUpload={handleImageUpload} 
            images={uploadedImages}
            cropAspectRatio={parseAspectRatio(aspectRatio)}
            onAnalyzePose={handleAnalyzePose}
            analyzingPoseIndex={isAnalyzingPose}
            onAnalyzeStyle={handleAnalyzeStyle}
            analyzingStyleIndex={isAnalyzingStyle}
            onGenerateControlMap={handleGenerateControlMap}
            generatingControlMapIndex={generatingControlMap}
            lockedCharacter={lockedCharacter}
            onSetCharacterLock={handleSetCharacterLock}
            styleReferenceIndex={styleReferenceIndex}
            onToggleStyleReference={handleToggleStyleReference}
          />
          <div className="flex flex-col w-full h-full gap-8">
            <ControlLayersManager 
              controlLayers={controlLayers}
              onLayersUpdate={handleLayersUpdate}
              initialPose={poseKeypoints}
              poseSourceImage={poseSourceImage}
              onClearPose={() => {
                setPoseKeypoints(null);
                setPoseSourceImage(null);
                setControlLayers(p => ({ ...p, pose: { ...p.pose, image: null } }));
              }}
            />
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
                useGoogleSearch={useGoogleSearch}
                onUseGoogleSearchChange={setUseGoogleSearch}
            />
          </div>
        </div>

        <div className="my-6 text-center w-full max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
                <h3 className="text-xl font-semibold text-white mb-3">3. 選擇長寬比</h3>
                <div className="p-2 bg-slate-700 rounded-lg">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {PREDEFINED_ASPECT_RATIOS.map(r => <AspectRatioButton key={r} value={r} label={r} />)}
                         <AspectRatioButton value="original" label="原始" disabled={!hasImages} />
                    </div>
                    <input type="text" placeholder="自訂 (例如: 21:9)" value={customAspectRatio} onChange={handleCustomAspectRatioChange}
                        className={`w-full mt-2 text-center px-2 py-2 text-sm font-medium rounded-md bg-slate-800 text-slate-300 border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-sky-500 ${isCustomRatioActive ? 'border-sky-600' : 'border-transparent'}`} />
                </div>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">4. 生成數量</h3>
                <div className="grid grid-cols-4 gap-2 p-1 bg-slate-700 rounded-lg h-[68px] items-center">
                    {[1, 2, 3, 4].map(v => <button key={v} onClick={() => setNumberOfVariations(v)} className={`py-2 text-sm rounded-md ${numberOfVariations === v ? 'bg-sky-600' : 'hover:bg-slate-600'}`}>{v}</button>)}
                </div>
            </div>
            <div className={styleReferenceIndex === null ? 'opacity-50' : ''}>
                <h3 className="text-xl font-semibold text-white mb-3">風格強度</h3>
                <div className="p-1 bg-slate-700 rounded-lg flex flex-col items-center justify-center h-[68px] px-4" title={styleReferenceIndex === null ? '請先選擇風格參考' : ''}>
                    <input type="range" min="10" max="100" step="5" value={styleStrength} onChange={(e) => setStyleStrength(Number(e.target.value))} disabled={styleReferenceIndex === null} className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed" />
                    <label className="text-white mt-2 font-mono text-sm">{styleStrength}%</label>
                </div>
            </div>
        </div>

        <div className="w-full max-w-5xl p-4 bg-slate-700 rounded-lg mb-6">
            <h3 className="text-xl font-semibold text-white mb-3 text-center">5. 隨機種子 (Seed)</h3>
            <div className="flex items-center justify-center gap-2">
                <input type="text" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="隨機" className="w-full max-w-xs p-2 bg-slate-800 rounded-md text-center font-mono" />
                <button onClick={() => setSeed(String(Math.floor(Math.random() * 999999999)))} title="隨機產生新種子" className="p-2 bg-slate-600 rounded-md hover:bg-slate-500">🎲</button>
                <button onClick={() => setIsSeedLocked(!isSeedLocked)} title={isSeedLocked ? "解鎖種子" : "鎖定種子"} className={`p-2 rounded-md ${isSeedLocked ? 'bg-sky-600' : 'bg-slate-600'}`}>{isSeedLocked ? '🔒' : '🔓'}</button>
            </div>
        </div>
        
        <div className="my-6 flex flex-col items-center gap-4">
            <div className="inline-block" title={getGenerateButtonTooltip()}>
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerateDisabled}
                  className="px-10 py-4 text-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {generateButtonText}
                </button>
            </div>
            <button onClick={() => setIsBatchModalOpen(true)} className="text-sm text-sky-400 hover:text-sky-300 underline transition-colors" disabled={!hasImages}>
                啟動批次處理模式
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
          onStartEditing={handleStartEditing}
          isEditing={editingState.isActive}
        />

        {results.length > 0 && !isLoading && !error && numberOfVariations === 1 && (
            <ChatEditor
                history={chatHistory}
                onSendMessage={handleChatEdit}
                isGenerating={isChatLoading}
                onZoomImage={handleZoomImage}
            />
        )}
        
        {editingState.isActive && editingState.imageSrc && (
          <GenerativeCanvas 
            src={editingState.imageSrc}
            onClose={handleCloseEditor}
            onConfirm={handleEditConfirm}
          />
        )}
        
        {isBatchModalOpen && (
            <BatchProcessModal
                onClose={() => setIsBatchModalOpen(false)}
                onStart={handleStartBatch}
                isRunning={isBatchRunning}
                results={batchResults}
                currentIndex={currentBatchIndex}
                prompts={batchPrompts}
            />
        )}
        
        {analyzedStyleResult && (
            <StyleAnalyzerResultModal
                text={analyzedStyleResult}
                onClose={() => setAnalyzedStyleResult(null)}
                onCopyToPrompt={(text) => setPrompt(p => p ? `${p}, ${text}` : text)}
                onSaveAsTemplate={handleSavePromptTemplate}
            />
        )}
        {zoomedImage && <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      </main>

      <footer className="mt-12 text-center text-slate-500 text-sm space-y-4">
        <SettingsManager 
            onExportProject={handleExportProject} 
            onImportProject={handleImportProject}
            presets={workflowPresets}
            onSavePreset={handleSavePreset}
            onLoadPreset={handleLoadPreset}
            onDeletePreset={handleDeletePreset}
        />
        <p>由 Google Gemini 提供技術支援。版本 {APP_VERSION}</p>
      </footer>
    </div>
  );
};

export default App;