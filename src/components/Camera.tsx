import { useEffect, useRef, useState } from 'react';

/** Webcam capture with a 3:4 portrait crop. */
export function Camera({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play();
        }
      })
      .catch(() => setError('No camera found, or camera access was denied.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const targetRatio = 3 / 4;
    let sw = v.videoWidth;
    let sh = v.videoHeight;
    if (sw / sh > targetRatio) sw = sh * targetRatio;
    else sh = sw / targetRatio;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    // Mirror horizontally so the saved photo matches the preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="camera">
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="camera-frame">
          <video ref={video} muted playsInline />
          <div className="camera-guide" />
        </div>
      )}
      <div className="btn-row">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        {!error && (
          <button className="btn primary" onClick={capture}>
            Capture
          </button>
        )}
      </div>
    </div>
  );
}
