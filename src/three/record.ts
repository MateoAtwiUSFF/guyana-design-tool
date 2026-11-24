// Records a <canvas> to a video file with MediaRecorder.
const CANDIDATES = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

export const pickVideoFormat = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
};

export const recordCanvas = (
  canvas: HTMLCanvasElement,
  mime: string,
  ms: number,
  onProgress: (p: number) => void,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onerror = () => reject(new Error('Recording failed'));
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    };
    rec.start(250);
    const t0 = performance.now();
    const tick = () => {
      const p = (performance.now() - t0) / ms;
      onProgress(Math.min(1, p));
      if (p >= 1) rec.stop();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
