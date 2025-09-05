
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { GenerationResult, Pose } from '../types';

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
    
    if (!generatedImage) {
        throw new Error("The API did not return an image. It might have refused the request. " + (generatedText || ""));
    }

    return { image: generatedImage, text: generatedText };
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
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: numberOfImages,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
          negativePrompt: negativePrompt || undefined,
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
      return { image: imageUrl, text: null };
    });

  } catch (error) {
    console.error("Error generating image from prompt with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image from prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image from prompt.");
  }
};

export const generateImageFromPose = async (
  baseImages: string[],
  poseImage: string,
  negativePrompt: string,
  aspectRatio: string,
  numberOfVariations: number,
  lockedCharacter: CharacterLock | null,
  styleReferenceIndex: number | null,
  styleStrength: number,
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImageParts = baseImages.map(fileToGenerativePart);
  const poseImagePart = fileToGenerativePart(poseImage);

  let text = `Your primary task is to generate an image with a final canvas that has a strict ${aspectRatio} aspect ratio. A 16:9 ratio is a wide landscape, and 9:16 is a tall portrait. 
    
To achieve this ${aspectRatio} canvas, you MUST perform outpainting: intelligently expand the scene and background from the input images to fill the entire frame. Do not crop, stretch, distort, or add black bars (letterboxing). The content must naturally fill the entire canvas.

Within this ${aspectRatio} canvas, the subjects from the input images must be performing the exact pose shown in the stick figure drawing. Preserve the subjects' appearance, clothing, and the original background style as much as possible. The main change should be the pose, adapted to fit the new ${aspectRatio} frame.`;

  text += createCharacterLockPrompt(lockedCharacter);

  if (styleReferenceIndex !== null) {
      text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
  }
  if (negativePrompt) {
    text += `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".`;
  }
  const textPart = { text };

  try {
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [...baseImageParts, poseImagePart, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }).then(parseImageGenerationResponse)
    );

    const results = await Promise.all(generationPromises);
    return results;

  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image.");
  }
};

const createEditingTextPart = (
    prompt: string, 
    negativePrompt: string, 
    aspectRatio: string,
    lockedCharacter: CharacterLock | null,
    styleReferenceIndex: number | null,
    styleStrength: number,
) => {
    let text = `Your primary task is to generate an image with a final canvas that has a strict ${aspectRatio} aspect ratio. A 16:9 ratio is a wide landscape, and 9:16 is a tall portrait. 
    
To achieve this ${aspectRatio} canvas, you MUST perform outpainting: intelligently expand the scene and background from the input images to fill the entire frame. Do not crop, stretch, distort, or add black bars (letterboxing). The content must naturally fill the entire canvas.

Within this ${aspectRatio} canvas, apply the following instruction to the input images: "${prompt}".`;

    text += createCharacterLockPrompt(lockedCharacter);

    if (styleReferenceIndex !== null) {
        text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
    }
    if (negativePrompt) {
        text += `\n\nIMPORTANT: Strictly avoid generating any of the following elements: "${negativePrompt}".`;
    }
    
    return { text };
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
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImageParts = baseImages.map(fileToGenerativePart);
  const textPart = createEditingTextPart(prompt, negativePrompt, aspectRatio, lockedCharacter, styleReferenceIndex, styleStrength);


  try {
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [...baseImageParts, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }).then(parseImageGenerationResponse)
    );

    const results = await Promise.all(generationPromises);
    return results;

  } catch (error) {
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
): Promise<GenerationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImagePart = fileToGenerativePart(baseImage);
  const maskImagePart = fileToGenerativePart(maskImage);

  let text = `You are an expert image editor performing an inpainting task. You will be given three inputs: a source image, a mask image, and a text prompt.

Your task is to modify the source image *only* in the areas designated by the mask. The mask is a black and white image; you must edit the source image where the mask is WHITE and leave the areas where the mask is BLACK completely unchanged.

The edits you make should be based on this instruction: "${prompt}".

The final output image must have a strict ${aspectRatio} aspect ratio. To achieve this, you may need to perform outpainting to expand the scene and background naturally to fill the entire frame without distortion or letterboxing. The inpainting edit should be seamlessly blended into the potentially expanded canvas.
`;
  text += createCharacterLockPrompt(lockedCharacter);
  
  if (styleReferenceIndex !== null) {
      text += `\n\n風格參考：請以 ${styleStrength}% 的強度嚴格遵循圖片 ${styleReferenceIndex + 1} 的藝術風格、色彩搭配和整體氛圍來生成最終圖片。`;
  }
  if (negativePrompt) {
    text += `\nIMPORTANT: When generating the new content, strictly avoid including any of the following: "${negativePrompt}".`;
  }
  const textPart = { text };

  try {
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [baseImagePart, maskImagePart, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }).then(parseImageGenerationResponse)
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
