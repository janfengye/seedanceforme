import { useEffect, useRef, useCallback } from 'react';
import { clearAllShotDrafts } from './useShotDraftCache';
import { get, set, del, keys } from 'idb-keyval';
import type { ModelId, AspectRatio, Duration, ReferenceMode, UploadedImage, UploadedAudio } from '../types/index';

const LS_KEY = 'seedance_draft_single';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftMeta {
  version: 1;
  savedAt: number;
  tiptapJson: any;
  model: ModelId;
  ratio: AspectRatio;
  duration: Duration;
  referenceMode: ReferenceMode;
  imageIds: string[];
  imageNames: string[];
  audioIds: string[];
  audioNames: string[];
}

interface DraftState {
  tiptapJson: any;
  model: ModelId;
  ratio: AspectRatio;
  duration: Duration;
  referenceMode: ReferenceMode;
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
}

export function useDraftPersistence() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(async (state: {
    editorJson: any;
    model: ModelId;
    ratio: AspectRatio;
    duration: Duration;
    referenceMode: ReferenceMode;
    images: UploadedImage[];
    audioFiles: UploadedAudio[];
  }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const meta: DraftMeta = {
          version: 1,
          savedAt: Date.now(),
          tiptapJson: state.editorJson,
          model: state.model,
          ratio: state.ratio,
          duration: state.duration,
          referenceMode: state.referenceMode,
          imageIds: state.images.map((i) => i.id),
          imageNames: state.images.map((i) => i.file.name),
          audioIds: state.audioFiles.map((a) => a.id),
          audioNames: state.audioFiles.map((a) => a.file.name),
        };
        localStorage.setItem(LS_KEY, JSON.stringify(meta));

        // Save file blobs to IndexedDB
        for (const img of state.images) {
          await set(`img-${img.id}`, img.file);
        }
        for (const aud of state.audioFiles) {
          await set(`aud-${aud.id}`, aud.file);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          // Only save text, skip files
          console.warn('Draft persistence: quota exceeded, saving text only');
        } else {
          console.warn('Draft persistence: save error', e);
        }
      }
    }, 800);
  }, []);

  const loadDraft = useCallback(async (): Promise<DraftState | null> => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;

      const meta: DraftMeta = JSON.parse(raw);
      if (!meta.version || Date.now() - meta.savedAt > EXPIRY_MS) {
        clearDraft();
        return null;
      }

      // Restore images from IndexedDB
      const images: UploadedImage[] = [];
      for (let i = 0; i < meta.imageIds.length; i++) {
        const file = await get(`img-${meta.imageIds[i]}`);
        if (file instanceof File) {
          images.push({
            id: meta.imageIds[i],
            file,
            previewUrl: URL.createObjectURL(file),
            index: i + 1,
          });
        }
      }

      // Restore audio from IndexedDB
      const audioFiles: UploadedAudio[] = [];
      for (let i = 0; i < meta.audioIds.length; i++) {
        const file = await get(`aud-${meta.audioIds[i]}`);
        if (file instanceof File) {
          audioFiles.push({
            id: meta.audioIds[i],
            file,
            name: meta.audioNames[i] || file.name,
            index: i + 1,
          });
        }
      }

      return {
        tiptapJson: meta.tiptapJson,
        model: meta.model,
        ratio: meta.ratio,
        duration: meta.duration,
        referenceMode: meta.referenceMode,
        images,
        audioFiles,
      };
    } catch (e) {
      console.warn('Draft persistence: load error', e);
      clearDraft();
      return null;
    }
  }, []);

  const clearDraft = useCallback(async () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const meta: DraftMeta = JSON.parse(raw);
        // Clean up IndexedDB entries
        for (const id of meta.imageIds) await del(`img-${id}`).catch(() => {});
        for (const id of meta.audioIds) await del(`aud-${id}`).catch(() => {});
      }
    } catch {}
    localStorage.removeItem(LS_KEY);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}

/**
 * Clear all draft data. Can be called without the hook (e.g., from AppContext logout).
 */
export async function clearAllDrafts() {
  localStorage.removeItem(LS_KEY);
  await clearAllShotDrafts();
  try {
    const allKeys = await keys();
    for (const key of allKeys) {
      const k = String(key);
      if (k.startsWith('img-') || k.startsWith('aud-')) {
        await del(key);
      }
    }
  } catch {}
}
