import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { GenerationResult, Pose, ChatMessage, ControlLayers, ControlLayerData } from '../types';

interface CharacterLock {
  index: number;
  lockAppearance: boolean;
  lockClothing: boolean;
}

// Helper to convert base64 data URL to the format Gemini needs
const fileToGenerativePart = (dataUrl: string) => {
  const [header, data] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
};

// Helper to parse the response from gemini-2.5-flash-image-preview
const parseImageGenerationResponse = (response: any): GenerationResult => {
    let generatedImage: string | null = null;
    let generatedText: string | null = null;

    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                generatedImage = `data:${mimeType};base64,${base64ImageBytes}`;
            } else if (part.text) {
                generatedText = (generatedText || '') + part.text;
            }
        }
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    
    if (!generatedImage) {
        throw new Error("The API did not return an image. It might have refused the request. " + (generatedText || ""));
    }

    // Note: gemini-2.5-flash-image-preview doesn't return the seed in its response.
    // The seed is managed client-side and passed back with the result.
    return { image: generatedImage, text: generatedText, groundingChunks };
};

const createCharacterLockPrompt = (lockedCharacter: CharacterLock | null): string => {
    if (!lockedCharacter) return '';

    const { index, lockAppearance, lockClothing } = lockedCharacter;
    let lockText = '';

    if (lockAppearance && lockClothing) {
        lockText = `角色鎖定：主要人物的身份應基於圖片 ${index + 1} 的角色。請保持其核心外貌特徵（如臉型、髮型）和服裝風格一致。然而，為了讓畫面更自然，你可以根據新的動作和場景微調其表情和細節。動作和姿勢可以完全改變。`;
    } else if (lockAppearance) {
        lockText = `角色外貌鎖定：主要人物的身份應基於圖片 ${index + 1} 的角色。請保持其核心外貌特徵（如臉型、髮型、身體特徵）一致。然而，為了讓畫面更自然，你可以根據新的動作和場景微調其表情和細節。服裝和動作可以完全改變。`;
    } else if (lockClothing) {
        lockText = `角色服裝鎖定：主要人物應穿著與圖片 ${index + 1} 中款式和顏色相同的服裝。請保持服裝設計不變，但可以根據新的動作自然地呈現皺摺和動態。角色的外貌和動作可以改變。`;
    }

    return lockText ? `\n\n${lockText}` : '';
}

export const generateImageFromPrompt = async (
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  numberOfImages: number,
  useGoogleSearch: boolean,
  seed: number | null,
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    if (useGoogleSearch) {
        const text = `Generate an image with a strict ${aspectRatio} aspect ratio. The prompt is: "${prompt}".` + (negativePrompt ? `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".` : '');
        const textPart = { text };
        
        const generationPromises = Array.from({ length: numberOfImages }).map(() =>
            ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                    tools: [{ googleSearch: {} }],
                    ...(seed !== null && { seed: seed }),
                },
            }).then(response => ({ ...parseImageGenerationResponse(response), seed }))
        );

        return await Promise.all(generationPromises);

    } else {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: numberOfImages,
              outputMimeType: 'image/png',
              aspectRatio: aspectRatio,
              negativePrompt: negativePrompt || undefined,
              ...(seed !== null && { seed: seed }),
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("The API did not return an image.");
        }

        return response.generatedImages.map(generatedImage => {
          if (!generatedImage.image?.imageBytes) {
              throw new Error("API response contained an image object without image data.");
          }
          const base64ImageBytes: string = generatedImage.image.imageBytes;
          const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
          // `generateImages` returns the seed it used
          return { image: imageUrl, text: null, groundingChunks: [], seed: (generatedImage as any).seed };
        });
    }

  } catch (error) {
    console.error("Error generating image from prompt with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image from prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image from prompt.");
  }
};

export const generateImageWithControls = async (
  baseImages: string[],
  prompt: string,
  negativePrompt: string,
  controlLayers: ControlLayers,
  aspectRatio: string,
  numberOfVariations: number,
  lockedCharacter: CharacterLock | null,
  styleReferenceIndex: number | null,
  styleStrength: number,
  useGoogleSearch: boolean,
  seed: number | null,
): Promise<GenerationResult[]> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = baseImages.map(fileToGenerativePart);
    const controlPrompts: string[] = [];
    
    const addControlPrompt = (data: ControlLayerData, description: string) => {
        if (data.image) {
            parts.push(fileToGenerativePart(data.image));
            const weight = data.weight;
            let strengthAdverb = '';
            if (weight < 50) strengthAdverb = 'loosely reference';
            else if (weight < 90) strengthAdverb = 'generally follow';
            else if (weight <= 110) strengthAdverb = 'strictly follow';
            else if (weight <= 150) strengthAdverb = 'very strictly follow with high precision';
            else strengthAdverb = 'follow with extreme, absolute, pixel-level precision';

            controlPrompts.push(`- **${description} (Strength: ${weight}%)**: You MUST ${strengthAdverb} the provided "${description}" map.`);
        }
    };

    addControlPrompt(controlLayers.pose, 'Pose Guidance');
    addControlPrompt(controlLayers.canny, 'Canny Edge Map');
    addControlPrompt(controlLayers.depth, 'Depth Map');
    addControlPrompt(controlLayers.scribble, 'Scribble Guide');

    let text = `You are an expert image editor. Your primary task is to generate a new image that perfectly matches the provided ${aspectRatio} aspect ratio.

You MUST follow all provided control maps according to their specified strengths:
${controlPrompts.join("\n")}

Apply the following creative prompt to this structure: "${prompt}".`;
    
    text += createCharacterLockPrompt(lockedCharacter);

    if (styleReferenceIndex !== null) {
        text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
    }

    if (negativePrompt) {
        text += `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".`;
    }

    parts.push({ text });

    const genConfig: any = {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        ...(seed !== null && { seed: seed }),
    };
    if (useGoogleSearch) {
        genConfig.tools = [{googleSearch: {}}];
    }

    try {
        const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
            ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: genConfig,
            }).then(response => ({ ...parseImageGenerationResponse(response), seed }))
        );
        const results = await Promise.all(generationPromises);
        return results;
    } catch (error) {
        console.error("Error generating image with controls:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate image with controls: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating image with controls.");
    }
};


export const editImageWithPrompt = async (
  baseImages: string[],
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  numberOfVariations: number,
  lockedCharacter: CharacterLock | null,
  styleReferenceIndex: number | null,
  styleStrength: number,
  useGoogleSearch: boolean,
  seed: number | null,
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImageParts = baseImages.map(fileToGenerativePart);
  
  let text = `Your primary task is to generate an image with a final canvas that has a strict ${aspectRatio} aspect ratio.
Within this ${aspectRatio} canvas, apply the following instruction to the input images: "${prompt}".`;

  text += createCharacterLockPrompt(lockedCharacter);

  if (styleReferenceIndex !== null) {
      text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
  }
  if (negativePrompt) {
      text += `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".`;
  }
  const textPart = { text };

  const genConfig: any = {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      ...(seed !== null && { seed: seed }),
  };
  if (useGoogleSearch) {
      genConfig.tools = [{googleSearch: {}}];
  }

  try {
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [...baseImageParts, textPart],
            },
            config: genConfig,
        }).then(response => ({ ...parseImageGenerationResponse(response), seed }))
    );

    const results = await Promise.all(generationPromises);
    return results;

  } catch (error)
 {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to edit image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while editing the image.");
  }
};

export const editImageWithMask = async (
  baseImage: string,
  maskImage: string,
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  numberOfVariations: number,
  lockedCharacter: CharacterLock | null,
  styleReferenceIndex: number | null,
  styleStrength: number,
  useGoogleSearch: boolean,
  seed: number | null,
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImagePart = fileToGenerativePart(baseImage);
  const maskImagePart = fileToGenerativePart(maskImage);

  let text = `You are an expert image editor performing an inpainting/outpainting task. You will be given three inputs: a source image (which may have transparent areas), a mask image, and a text prompt.

Your task is to generate new content *only* in the areas designated by the mask. The mask is a black and white image; you must generate content where the mask is WHITE and leave the areas where the mask is BLACK completely unchanged. The source image provides context for the black areas.

The edits you make should be based on this instruction: "${prompt}".

The final output image must have a strict ${aspectRatio} aspect ratio. The generated content should be seamlessly blended into the source image's context.
`;
  text += createCharacterLockPrompt(lockedCharacter);
  
  if (styleReferenceIndex !== null) {
      text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
  }
  if (negativePrompt) {
    text += `\nIMPORTANT: When generating the new content, strictly avoid including any of the following: "${negativePrompt}".`;
  }
  const textPart = { text };
  
  const genConfig: any = {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      ...(seed !== null && { seed: seed }),
  };
  if (useGoogleSearch) {
      genConfig.tools = [{googleSearch: {}}];
  }

  try {
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [baseImagePart, maskImagePart, textPart],
            },
            config: genConfig,
        }).then(response => ({ ...parseImageGenerationResponse(response), seed }))
    );

    const results = await Promise.all(generationPromises);
    return results;

  } catch (error) {
    console.error("Error editing image with mask using Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to edit image with mask: ${error.message}`);
    }
    throw new Error("An unknown error occurred while editing the image with a mask.");
  }
};

export const editImageWithChat = async (
  history: ChatMessage[],
  newPrompt: string,
  negativePrompt: string,
  aspectRatio: string,
  lockedCharacter: CharacterLock | null,
  styleReferenceIndex: number | null,
  styleStrength: number,
  useGoogleSearch: boolean,
  seed: number | null,
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];
  
  // Construct the history parts
  for (const message of history) {
    const messageParts = [];
    if (message.image) {
      messageParts.push(fileToGenerativePart(message.image));
    }
    if (message.text) {
      messageParts.push({ text: message.text });
    }
    parts.push(...messageParts);
  }
  
  let instructionText = `Apply this new instruction to the last image, considering the conversation context: "${newPrompt}".
The final output image must have a strict ${aspectRatio} aspect ratio. The edit should be seamlessly blended into the canvas.
`;
  instructionText += createCharacterLockPrompt(lockedCharacter);

  if (styleReferenceIndex !== null) {
      instructionText += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
  }
  if (negativePrompt) {
      instructionText += `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".`;
  }

  parts.push({ text: instructionText });

  const genConfig: any = {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      ...(seed !== null && { seed: seed }),
  };
  if (useGoogleSearch) {
      genConfig.tools = [{googleSearch: {}}];
  }

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: { parts },
          config: genConfig,
      });
      return { ...parseImageGenerationResponse(response), seed };
  } catch (error) {
      console.error("Error editing image with chat:", error);
      if (error instanceof Error) {
          throw new Error(`Failed to edit image with chat: ${error.message}`);
      }
      throw new Error("An unknown error occurred while editing the image with chat.");
  }
};

// This function is deprecated and its functionality is now inside editImageWithMask
export const expandImage = async (): Promise<GenerationResult> => {
  throw new Error("expandImage is deprecated. Use editImageWithMask for outpainting.");
};

export const optimizePrompt = async (
  originalPrompt: string,
  uploadedImageCount: number,
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let systemInstruction: string;
  if (uploadedImageCount > 0) {
    systemInstruction = "你是一位专业的AI圖像生成模型提示詞工程師。你的任務是重寫用户的提示詞，使其更具描述性、生動性和細節性，從而生成更高質量、更準確的圖像。用户已經上傳了圖片，所以請你只優化動作和場景的描述，不要修改或添加關於人物外貌、衣着等主體特徵的描述。請只用中文輸出重寫後的提示詞，不要添加任何額外的解釋、問候或markdown格式。";
  } else {
    systemInstruction = "你是一位专业的AI圖像生成模型提示詞工程師。你的任務是重寫用户的提示詞，使其更具描述性、生動性和細節性，從而生成更高質量、更準確的圖像。請專注於添加關於主體、動作、環境、光照、情緒和藝術風格的具體細節。請只用中文輸出重寫後的提示詞，不要添加任何額外的解釋、問候或markdown格式。";
  }


  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `重寫這個提示詞: "${originalPrompt}"`,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const optimizedText = response.text;
    if (!optimizedText || optimizedText.trim() === '') {
      throw new Error("The API did not return an optimized prompt.");
    }
    return optimizedText.trim();

  } catch (error) {
    console.error("Error optimizing prompt:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to optimize prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while optimizing the prompt.");
  }
};

export const generateInspiration = async (
  currentPrompt: string,
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = "你是一位世界級的 AI 藝術提示詞工程師。你的任務是生成一個高度詳細、富有創意和詩意的提示詞，用於圖像生成模型。提示詞應具有描述性和想像力。請只用中文輸出提示詞，不要添加任何額外的文字、問候或 markdown 格式。";
  
  const userMessage = currentPrompt 
    ? `請根據這個想法生成一個全新的、更詳細、更有創意的提示詞：「${currentPrompt}」`
    : "請隨機生成一個高度詳細、富有創意的提示詞，用於創作一幅令人驚嘆的數位藝術作品。";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userMessage,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const inspiredText = response.text;
    if (!inspiredText || inspiredText.trim() === '') {
      throw new Error("The API did not return an inspired prompt.");
    }
    return inspiredText.trim();

  } catch (error) {
    console.error("Error generating inspiration:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate inspiration: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating inspiration.");
  }
};

export const analyzeStyle = async (base64Image: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(base64Image);

  const systemInstruction = `You are a world-class art critic and AI prompt engineer. Your task is to analyze an image and generate a highly descriptive, vivid, and detailed text prompt that would allow an AI image generator to recreate its style.

Focus on:
- **Artistic Style:** (e.g., photorealistic, impressionistic, anime, cartoon, 3D render, watercolor)
- **Medium:** (e.g., oil painting, digital painting, photograph, pencil sketch)
- **Lighting:** (e.g., cinematic lighting, soft studio lighting, dramatic backlighting, golden hour)
- **Color Palette:** (e.g., vibrant and saturated, muted and desaturated, pastel colors, monochrome)
- **Composition:** (e.g., centered, rule of thirds, wide shot, close-up)
- **Mood/Atmosphere:** (e.g., epic, serene, mysterious, cheerful, cyberpunk)
- **Key Details & Textures:** (e.g., hyperdetailed, intricate patterns, sharp focus, lens flare, film grain)

Output ONLY the prompt text in Chinese, as a series of descriptive keywords and phrases separated by commas. Do not add any extra explanations, greetings, or markdown formatting.`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, {text: "Analyze this image and generate a prompt for its style."}] },
        config: { systemInstruction },
    });
    
    const styleText = response.text;
    if (!styleText || styleText.trim() === '') {
      throw new Error("The API did not return a style analysis.");
    }
    return styleText.trim();

  } catch (error) {
    console.error("Error analyzing style:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze style: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing style.");
  }
};


const POSE_KEYPOINTS = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle"
] as const;


export const analyzePose = async (base64Image: string): Promise<Pose> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(base64Image);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: "Analyze the pose of the primary person in the image. Identify the specified keypoints. If a keypoint is not visible, estimate its position. Ensure the output strictly adheres to the provided JSON schema. The coordinate system is normalized, with (0,0) at the top-left corner and (1,1) at the bottom-right." },
          imagePart
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
              pose: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      enum: POSE_KEYPOINTS,
                    },
                    x: {
                      type: Type.NUMBER,
                      description: "The normalized x-coordinate (0 to 1, from left to right)."
                    },
                    y: {
                      type: Type.NUMBER,
                      description: "The normalized y-coordinate (0 to 1, from top to bottom)."
                    }
                  },
                  required: ["name", "x", "y"]
                }
              }
            },
            required: ["pose"]
        }
      }
    });
    
    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    if (!parsed.pose || !Array.isArray(parsed.pose)) {
        throw new Error("Invalid response format from pose analysis API.");
    }
    
    // Validate that the returned pose keypoints match what we expect
    const receivedKeypoints = new Set(parsed.pose.map((p: any) => p.name));
    if (receivedKeypoints.size < 5) { // Heuristic: if less than 5 points, it's likely a bad detection
      throw new Error("Could not detect a person or pose in the image. Please try a different photo.");
    }

    return parsed.pose;

  } catch (error) {
    console.error("Error analyzing pose with Gemini:", error);
    if (error instanceof Error) {
        if (error.message.includes("Could not detect a person")) {
            throw error;
        }
        throw new Error(`Failed to analyze pose: ${error.message}`);
    }
    throw new Error("An unknown error occurred while analyzing the pose.");
  }
};

export const generateCannyEdgeMap = async (base64Image: string): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(base64Image);
  const textPart = { text: "IDENTITY: You are a non-creative computer vision service. TASK: Perform edge detection. INPUT: An image. OUTPUT: A binary image of the same dimensions. STRICT RULES: 1. Background MUST be pure black (#000000). 2. Detected edges MUST be pure white (#FFFFFF), single-pixel thin lines. 3. There must be ZERO gray pixels, anti-aliasing, colors, or textures. 4. NO part of the original image should be present in the output. Execute this data transformation precisely." };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    return parseImageGenerationResponse(response);
  } catch (error) {
    console.error("Error generating canny edge map:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate canny edge map: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the canny edge map.");
  }
};

export const generateDepthMap = async (base64Image: string): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(base64Image);
  const textPart = { text: "IDENTITY: You are a non-creative computer vision service. TASK: Perform depth estimation. INPUT: An image. OUTPUT: A grayscale depth map of the same dimensions. STRICT RULES: 1. The output MUST be a grayscale image only. 2. Lighter values (approaching pure white #FFFFFF) represent objects closer to the camera. 3. Darker values (approaching pure black #000000) represent objects further away. 4. The output must be a smooth, clean gradient representing spatial depth. 5. DO NOT include any color, patterns, or textures from the original input image. Execute this data transformation precisely." };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [imagePart, textPart] },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    return parseImageGenerationResponse(response);
  } catch (error) {
    console.error("Error generating depth map:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate depth map: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the depth map.");
  }
};