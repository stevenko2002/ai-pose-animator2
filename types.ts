export interface GenerationResult {
  image: string | null;
  text: string | null;
}

export interface Keypoint {
  name: string;
  x: number;
  y: number;
}

export type Pose = Keypoint[];
