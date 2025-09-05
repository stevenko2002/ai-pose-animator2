import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerationResult } from '../types';

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

export const generateImageFromPrompt = async (
  prompt: string,
  aspectRatio: string,
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image?.imageBytes) {
        throw new Error("The API did not return an image.");
    }

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

    return { image: imageUrl, text: null };

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
  aspectRatio: string,
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImageParts = baseImages.map(fileToGenerativePart);
  const poseImagePart = fileToGenerativePart(poseImage);

  const textPart = {
    text: `Your primary task is to generate an image with a final canvas that has a strict ${aspectRatio} aspect ratio. A 16:9 ratio is a wide landscape, and 9:16 is a tall portrait. 
    
To achieve this ${aspectRatio} canvas, you MUST perform outpainting: intelligently expand the scene and background from the input images to fill the entire frame. Do not crop, stretch, distort, or add black bars (letterboxing). The content must naturally fill the entire canvas.

Within this ${aspectRatio} canvas, the subjects from the input images must be performing the exact pose shown in the stick figure drawing. Preserve the subjects' appearance, clothing, and the original background style as much as possible. The main change should be the pose, adapted to fit the new ${aspectRatio} frame.`,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [...baseImageParts, poseImagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    return parseImageGenerationResponse(response);

  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image.");
  }
};

export const editImageWithPrompt = async (
  baseImages: string[],
  prompt: string,
  aspectRatio: string,
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImageParts = baseImages.map(fileToGenerativePart);

  const textPart = {
    text: `Your primary task is to generate an image with a final canvas that has a strict ${aspectRatio} aspect ratio. A 16:9 ratio is a wide landscape, and 9:16 is a tall portrait. 
    
To achieve this ${aspectRatio} canvas, you MUST perform outpainting: intelligently expand the scene and background from the input images to fill the entire frame. Do not crop, stretch, distort, or add black bars (letterboxing). The content must naturally fill the entire canvas.

Within this ${aspectRatio} canvas, apply the following instruction to the input images: "${prompt}".`,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [...baseImageParts, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    
    return parseImageGenerationResponse(response);

  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to edit image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while editing the image.");
  }
};

export const optimizePrompt = async (
  originalPrompt: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = "You are an expert prompt engineer for AI image generation models. Your task is to rewrite a user's prompt to be more descriptive, vivid, and detailed, which will result in a higher quality and more accurate image. Focus on adding specifics about subjects, actions, environment, lighting, mood, and artistic style. Respond ONLY with the rewritten prompt as plain text, without any additional explanations, greetings, or markdown formatting.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Rewrite this prompt: "${originalPrompt}"`,
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
