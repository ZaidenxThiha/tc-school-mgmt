// Shared face-detection shapes (used by both server code and the browser client,
// so neither pulls the other's runtime in).

export type FaceQuality = {
  size_px: number;
  blur: number;
  brightness: number;
  pose_ok: boolean;
};

export type DetectedFace = {
  bbox: [number, number, number, number]; // x, y, w, h
  det_score: number;
  embedding: number[]; // 512 L2-normalized floats
  quality: FaceQuality;
};
