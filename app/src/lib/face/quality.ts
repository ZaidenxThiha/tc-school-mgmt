import type { DetectedFace } from '@/lib/face/engine';

// Face-quality gate. Rejects detections that are too small / blurry / dark / off
// to one side or low detector confidence, so we don't register or match on a bad
// crop. Thresholds are intentionally lenient; tune via app_settings over time.

export type QualityCheck = { ok: true } | { ok: false; reason: string };

const MIN_DET_SCORE = 0.5;
const MIN_BLUR = 25; // Laplacian variance; lower = blurrier
const MIN_BRIGHTNESS = 0.18;
const MAX_BRIGHTNESS = 0.95;

export function checkQuality(face: DetectedFace, minFacePx: number): QualityCheck {
  if (face.det_score < MIN_DET_SCORE) return { ok: false, reason: 'low_detection_confidence' };
  if (face.quality.size_px < minFacePx) return { ok: false, reason: 'face_too_small' };
  if (face.quality.blur < MIN_BLUR) return { ok: false, reason: 'blurry' };
  if (face.quality.brightness < MIN_BRIGHTNESS) return { ok: false, reason: 'too_dark' };
  if (face.quality.brightness > MAX_BRIGHTNESS) return { ok: false, reason: 'overexposed' };
  if (!face.quality.pose_ok) return { ok: false, reason: 'bad_pose' };
  return { ok: true };
}
