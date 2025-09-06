export interface GenerationResult {
  image: string | null;
  text: string | null;
  groundingChunks?: GroundingChunk[];
  seed?: number | string | null;
}

export interface Keypoint {
  name: string;
  x: number;
  y: number;
}

export type Pose = Keypoint[];

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  image?: string;
}

export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    }
}

export interface StylePreset {
  name: string;
  prompt: string;
}

export type ControlType = 'canny' | 'depth' | 'scribble';

export interface StructuralControlData {
  image: string | null;
  type: ControlType;
}

export interface ControlLayerData {
    image: string | null;
    weight: number; // 0 to 200
}

export interface ControlLayers {
  pose: ControlLayerData;
  canny: ControlLayerData;
  depth: ControlLayerData;
  scribble: ControlLayerData;
}

export interface WorkflowPreset {
    name: string;
    state: {
        uploadedImages: (string | null)[];
        prompt: string;
        negativePrompt: string;
        controlLayers: ControlLayers;
        lockedCharacter: { index: number; lockAppearance: boolean; lockClothing: boolean; } | null;
        styleReferenceIndex: number | null;
        styleStrength: number;
        aspectRatio: string;
        useGoogleSearch: boolean;
        numberOfVariations: number;
        seed: string;
        isSeedLocked: boolean;
    }
}
