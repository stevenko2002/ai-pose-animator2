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

export const generatePromptSuggestion = async (
  base64Image: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(base64Image);

  const textPart = {
    text: "Concisely describe this image for another AI image generator. Focus on key subjects, their actions, the setting, and the overall artistic style. Make it sound like a creative prompt, starting with the main subject. Do not use markdown or formatting. Just output the plain text of the prompt.",
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, textPart],
      },
    });

    const suggestion = response.text;
    if (!suggestion) {
      throw new Error("The API did not return a text suggestion.");
    }
    return suggestion.trim();

  } catch (error) {
    console.error("Error generating prompt suggestion:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate suggestion: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the prompt suggestion.");
  }
};