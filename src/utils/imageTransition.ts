import type { FullscreenImageTransitionOrigin } from '../components/FullscreenImageViewer';

export const IMAGE_TRANSITION_MEASURE_TIMEOUT_MS = 150;

interface ImageTransitionMeasurable {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

export function measureImageTransitionOrigin(
  node: ImageTransitionMeasurable,
  borderRadius: number,
  onComplete: (origin: FullscreenImageTransitionOrigin | null) => void,
  timeoutMs = IMAGE_TRANSITION_MEASURE_TIMEOUT_MS,
): () => void {
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const finish = (origin: FullscreenImageTransitionOrigin | null) => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
    onComplete(origin);
  };

  timeout = setTimeout(() => finish(null), timeoutMs);

  try {
    node.measureInWindow((x, y, width, height) => {
      finish(width > 0 && height > 0
        ? { x, y, width, height, borderRadius }
        : null);
    });
  } catch {
    finish(null);
  }

  return () => {
    if (settled) return;
    settled = true;
    if (timeout) clearTimeout(timeout);
  };
}
