
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

export const generateImageFromPose = async (
  baseImage: string,
  poseImage: string
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set. Please ensure it is configured.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const baseImagePart = fileToGenerativePart(baseImage);
  const poseImagePart = fileToGenerativePart(poseImage);

  const textPart = {
    text: "Analyze the person in the first image and the stick figure pose in the second image. Generate a new image where the person from the first image is performing the exact pose from the second image. The background, clothing, and appearance of the person should be preserved as closely as possible, only the pose should change.",
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [baseImagePart, poseImagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

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

  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the image.");
  }
};
