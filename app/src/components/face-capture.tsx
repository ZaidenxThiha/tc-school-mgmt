'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, X } from 'lucide-react';

// Reusable capture widget for the Record Face page: live webcam snapshot OR file
// upload. Emits a raw base64 JPEG (no data: prefix) to `onCapture`. The image is
// never uploaded by this component itself — the parent decides what to do.
export default function FaceCapture({
  onCapture,
  disabled,
}: {
  onCapture: (base64: string | null) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError('Could not access the camera. Check browser permissions.');
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    onCapture(dataUrl.split(',')[1] ?? null);
    stopCamera();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpe?g|png)$/.test(file.type)) {
      setError('Please choose a JPEG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is larger than 5 MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreview(dataUrl);
      onCapture(dataUrl.split(',')[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    setPreview(null);
    onCapture(null);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md border border-slate-200 bg-slate-900/5 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? (
          <img src={preview} alt="Captured face" className="h-full w-full object-contain" />
        ) : (
          <video ref={videoRef} className={`h-full w-full object-cover ${cameraOn ? '' : 'hidden'}`} muted playsInline />
        )}
        {!preview && !cameraOn && <span className="text-sm text-slate-400">No image</span>}
        {preview && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 rounded-full bg-white/90 p-1 shadow hover:bg-white"
            aria-label="Clear image"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!cameraOn ? (
          <button type="button" onClick={startCamera} disabled={disabled} className="btn-ghost text-sm">
            <Camera size={14} /> Start camera
          </button>
        ) : (
          <button type="button" onClick={snap} disabled={disabled} className="btn-primary text-sm">
            <Camera size={14} /> Capture
          </button>
        )}
        <label className="btn-ghost text-sm cursor-pointer">
          <Upload size={14} /> Upload photo
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFile} disabled={disabled} />
        </label>
      </div>
    </div>
  );
}
