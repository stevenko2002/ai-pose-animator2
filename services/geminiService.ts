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

    return { image: generatedImage, text: generatedText, video: null };
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
    text: `Analyze the subjects in the input images and the stick figure pose in the final image. Generate a new image where the subjects from the input images are performing the exact pose from the stick figure image. The background, clothing, and appearance of the subjects should be preserved as closely as possible, only the pose should change. The final generated image must have a ${aspectRatio} aspect ratio.`,
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
    text: `Based on the provided images and the following instruction, generate a new image. Instruction: "${prompt}". The final generated image must have a ${aspectRatio} aspect ratio.`,
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

export const describePose = async (
  poseImage: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = fileToGenerativePart(poseImage);
  const textPart = {
    text: "Describe this stick figure pose in simple, clear, and concise terms for an animation AI. Example: 'A person stands with their left arm raised straight up and their right leg kicked out to the side'. Do not use markdown or formatting. Just output the plain text description.",
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, textPart],
      },
    });

    const description = response.text;
    if (!description) {
      throw new Error("The API did not return a pose description.");
    }
    return description.trim();
  } catch (error) {
    console.error("Error generating pose description:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate pose description: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the pose description.");
  }
};

export const generateVideoFromPose = async (
  baseImage: string,
  poseImage: string,
  onProgress: (message: string) => void,
): Promise<GenerationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  onProgress("Analyzing stick figure pose...");
  const poseDescription = await describePose(poseImage);

  onProgress("Preparing animation sequence...");
  const { data: imageBytes, mimeType } = fileToGenerativePart(baseImage).inlineData;
  const prompt = `Animate the person in the image to smoothly move from their current position into this described pose: "${poseDescription}". The background and the person's appearance should remain as consistent as possible. The video should be a short, seamless loop.`;

  let operation = await ai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt: prompt,
    image: { imageBytes, mimeType },
    config: { numberOfVideos: 1 },
  });

  const progressMessages = [
      "Choreographing the pixels...",
      "Rendering the digital performance...",
      "Adding motion magic...",
      "Finalizing the animation cut...",
  ];
  let messageIndex = 0;

  while (!operation.done) {
    onProgress(progressMessages[messageIndex % progressMessages.length]);
    messageIndex++;
    await new Promise(resolve => setTimeout(resolve, 8000));
    try {
        operation = await ai.operations.getVideosOperation({ operation: operation });
    } catch (e) {
        console.error("Polling failed, but will retry:", e);
    }
  }

  onProgress("Downloading generated video...");
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Video generation failed or did not produce a valid output link.");
  }

  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!response.ok) {
    throw new Error(`Failed to download the generated video. Server responded with status: ${response.status}`);
  }
  const videoBlob = await response.blob();
  const videoUrl = URL.createObjectURL(videoBlob);

  return { image: null, video: videoUrl, text: `Animated pose: ${poseDescription}` };
};
