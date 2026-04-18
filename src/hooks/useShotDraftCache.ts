import { useCallback, useRef, useEffect } from 'react';
import type { ModelId, AspectRatio, Duration, ReferenceMode, UploadedImage, UploadedAudio } from '../types/index';
import {
  getShotDraft,
  saveShotDraft,
  deleteShotDraft,
  uploadShotDraftFile,
  downloadShotDraftFile,
  deleteShotDraftFile,
} from '../services/projectService';
import { getAuthHeaders } from '../services/authService';

const API_BASE = '/api';
const DEBOUNCE_MS = 800;

export interface ShotDraftState {
  prompt: string;
  tiptapJson: any;
  model: ModelId;
  ratio: AspectRatio;
  duration: Duration;
  referenceMode: ReferenceMode;
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
}

// Track which file IDs are already on the server (avoids re-uploading)
const serverFileIdsMap = new Map<number, Set<string>>();

export function useShotDraftCache() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const suppressSaveRef = useRef(false);
  const pendingRef = useRef<{ shotId: number; state: Parameters<typeof doSave>[1] } | null>(null);

  const doSave = useCallback(async (shotId: number, state: {
    prompt: string;
    editorJson: any;
    model: ModelId;
    ratio: AspectRatio;
    duration: Duration;
    referenceMode: ReferenceMode;
    images: UploadedImage[];
    audioFiles: UploadedAudio[];
  }) => {
    if (suppressSaveRef.current) return;
    if (savingRef.current) {
      pendingRef.current = { shotId, state };
      return;
    }
    savingRef.current = true;
    try {
      // 1. Save metadata (auto-save: no expectedVersion)
      await saveShotDraft(shotId, {
        prompt: state.prompt,
        tiptapJson: state.editorJson,
        model: state.model,
        ratio: state.ratio,
        duration: String(state.duration),
        referenceMode: state.referenceMode,
      });

      // 2. Get server file IDs tracker
      const serverFileIds = serverFileIdsMap.get(shotId) ?? new Set<string>();
      serverFileIdsMap.set(shotId, serverFileIds);

      // 3. Sync files
      const desiredImageIds = new Set(state.images.map(i => i.id));
      const desiredAudioIds = new Set(state.audioFiles.map(a => a.id));
      const allDesiredIds = new Set([...desiredImageIds, ...desiredAudioIds]);

      for (const img of state.images) {
        if (!serverFileIds.has(img.id)) {
          await uploadShotDraftFile(shotId, img.id, img.file, 'image');
          serverFileIds.add(img.id);
        }
      }
      for (const aud of state.audioFiles) {
        if (!serverFileIds.has(aud.id)) {
          await uploadShotDraftFile(shotId, aud.id, aud.file, 'audio');
          serverFileIds.add(aud.id);
        }
      }

      // Delete server files no longer desired
      if (allDesiredIds.size > 0 || serverFileIds.size === 0) {
        for (const fid of serverFileIds) {
          if (!allDesiredIds.has(fid)) {
            try { await deleteShotDraftFile(fid); } catch {}
            serverFileIds.delete(fid);
          }
        }
      }
    } catch (e) {
      console.warn('Shot draft save error', e);
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        const { shotId: pShotId, state: pState } = pendingRef.current;
        pendingRef.current = null;
        doSave(pShotId, pState);
      }
    }
  }, []);

  const saveShotDraftDebounced = useCallback((shotId: number, state: Parameters<typeof doSave>[1]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    suppressSaveRef.current = false;
    timerRef.current = setTimeout(() => doSave(shotId, state), DEBOUNCE_MS);
  }, [doSave]);

  const saveShotDraftImmediate = useCallback((shotId: number, state: Parameters<typeof doSave>[1]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(shotId, state);
  }, [doSave]);

  const saveShotDraftBeforeUnload = useCallback((shotId: number, state: {
    prompt: string;
    editorJson: any;
    model: ModelId;
    ratio: AspectRatio;
    duration: Duration;
    referenceMode: ReferenceMode;
  }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const body = JSON.stringify({
      prompt: state.prompt,
      tiptapJson: state.editorJson,
      model: state.model,
      ratio: state.ratio,
      duration: String(state.duration),
      referenceMode: state.referenceMode,
    });
    const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
    try {
      fetch(`${API_BASE}/shots/${shotId}/draft`, {
        method: 'PUT',
        headers,
        body,
        keepalive: true,
      });
    } catch {}
  }, []);

  const loadShotDraft = useCallback(async (shotId: number): Promise<ShotDraftState | null> => {
    // Always fetch from server (no memory cache) to see teammate edits
    try {
      const draft = await getShotDraft(shotId);
      if (!draft) return null;

      const serverFileIds = new Set<string>();
      const images: UploadedImage[] = [];
      const audioFiles: UploadedAudio[] = [];

      // Parallel file download
      const fileResults = await Promise.all(
        (draft.files || []).map(async (f: any) => {
          serverFileIds.add(f.id);
          try {
            const blob = await downloadShotDraftFile(f.id);
            return { f, blob };
          } catch (e) {
            console.warn('Failed to download draft file', f.id, e);
            return null;
          }
        })
      );

      for (const result of fileResults) {
        if (!result) continue;
        const { f, blob } = result;
        const file = new File([blob], f.original_name, { type: f.mime_type });
        if (f.file_type === 'audio') {
          audioFiles.push({
            id: f.id,
            file,
            name: f.original_name,
            index: audioFiles.length + 1,
          });
        } else {
          images.push({
            id: f.id,
            file,
            previewUrl: URL.createObjectURL(blob),
            uploadStatus: "pending" as const,
            index: images.length + 1,
          });
        }
      }

      serverFileIdsMap.set(shotId, serverFileIds);

      return {
        prompt: draft.prompt || '',
        tiptapJson: draft.tiptap_json ? JSON.parse(draft.tiptap_json) : null,
        model: (draft.model || '') as ModelId,
        ratio: (draft.ratio || '') as AspectRatio,
        duration: (draft.duration ? Number(draft.duration) : 5) as Duration,
        referenceMode: (draft.reference_mode || '') as ReferenceMode,
        images,
        audioFiles,
      };
    } catch (e) {
      console.warn('Shot draft load error', e);
      return null;
    }
  }, []);

  const clearShotDraft = useCallback(async (shotId: number) => {
    try {
      serverFileIdsMap.delete(shotId);
      await deleteShotDraft(shotId);
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cancelPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    suppressSaveRef.current = true;
    pendingRef.current = null;
  }, []);

  return { saveShotDraftDebounced, saveShotDraftImmediate, saveShotDraftBeforeUnload, loadShotDraft, clearShotDraft, cancelPendingSave };
}

/**
 * Clear all shot draft data from memory. Called on logout.
 */
export async function clearAllShotDrafts() {
  serverFileIdsMap.clear();
}
