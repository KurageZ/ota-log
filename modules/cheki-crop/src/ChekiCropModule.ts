import { requireNativeModule } from 'expo';

export interface CropImage {
  uri: string;
  width: number;
  height: number;
}

// Normalized coordinates, top-left origin: TL, TR, BR, BL.
export type CropCorners = [number, number, number, number, number, number, number, number];

export interface CropDetection extends CropImage {
  candidates: { corners: CropCorners; confidence: number }[];
}

interface ChekiCropModule {
  whiteBalance(uri: string, x: number, y: number, strength: number): Promise<CropImage>;
  scanDocuments(): Promise<CropImage[] | null>;
  detect(uri: string): Promise<CropDetection>;
  crop(uri: string, corners: CropCorners): Promise<CropImage>;
}

// Resolve only on use so Android and web can load the route without an iOS module.
export function getChekiCropModule(): ChekiCropModule {
  return requireNativeModule<ChekiCropModule>('ChekiCrop');
}
