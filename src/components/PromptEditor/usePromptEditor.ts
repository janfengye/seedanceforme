import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useRef } from 'react';
import MentionNode from './MentionNode';
import type { UploadedImage, UploadedAudio } from '../../types/index';

/**
 * Serialize editor content to plain text with @图N / @音频N references.
 * Falls back to pure text if no mention nodes exist.
 */
export function serializePrompt(editor: Editor | null): string {
  if (!editor) return '';
  const doc = editor.getJSON();
  if (!doc.content) return '';

  const parts: string[] = [];
  for (const block of doc.content as any[]) {
    if (!block.content) {
      parts.push('');
      continue;
    }
    const lineParts: string[] = [];
    for (const node of block.content as any[]) {
      if (node.type === 'text') {
        lineParts.push(node.text || '');
      } else if (node.type === 'mediaRef') {
        const { mediaType, mediaIndex } = node.attrs || {};
        if (mediaType === 'audio') {
          lineParts.push(`@audio${mediaIndex}`);
        } else {
          lineParts.push(`@图${mediaIndex}`);
        }
      }
    }
    parts.push(lineParts.join(''));
  }
  return parts.join('\n');
}

interface UsePromptEditorOptions {
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
  isGenerating: boolean;
  onSerializedChange: (text: string) => void;
}

export function usePromptEditor({ images, audioFiles, isGenerating, onSerializedChange }: UsePromptEditorOptions) {
  const onSerializedChangeRef = useRef(onSerializedChange);
  onSerializedChangeRef.current = onSerializedChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level nodes we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: '描述你想要生成的视频场景。上传参考图后可使用 @ 引用图片或音频...',
      }),
      MentionNode,
    ],
    editable: !isGenerating,
    onUpdate: ({ editor }) => {
      onSerializedChangeRef.current(serializePrompt(editor));
    },
  });

  // Update editable state when isGenerating changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isGenerating);
    }
  }, [editor, isGenerating]);

  // Clean up orphaned mention nodes when images/audio change
  useEffect(() => {
    if (!editor) return;
    const doc = editor.getJSON();
    if (!doc.content) return;

    let needsUpdate = false;
    const imageIds = new Set(images.map((i) => i.id));
    const audioIds = new Set(audioFiles.map((a) => a.id));

    // Build new index mapping
    const imageIndexMap = new Map(images.map((img) => [img.id, img.index]));
    const audioIndexMap = new Map(audioFiles.map((aud) => [aud.id, aud.index]));

    const walk = (content: any[]): any[] => {
      return content.map((node) => {
        if (node.type === 'mediaRef') {
          const { mediaId, mediaType, mediaIndex } = node.attrs;
          const validIds = mediaType === 'audio' ? audioIds : imageIds;
          if (!validIds.has(mediaId)) {
            needsUpdate = true;
            return null; // Remove orphaned node
          }
          const indexMap = mediaType === 'audio' ? audioIndexMap : imageIndexMap;
          const newIndex = indexMap.get(mediaId);
          if (newIndex !== undefined && newIndex !== mediaIndex) {
            needsUpdate = true;
            return { ...node, attrs: { ...node.attrs, mediaIndex: newIndex } };
          }
          return node;
        }
        if (node.content) {
          const newContent = walk(node.content).filter(Boolean);
          if (newContent.length !== node.content.length) needsUpdate = true;
          return { ...node, content: newContent };
        }
        return node;
      });
    };

    const newContent = walk(doc.content).filter(Boolean);
    if (needsUpdate) {
      editor.commands.setContent({ type: 'doc', content: newContent });
    }
  }, [editor, images, audioFiles]);

  const insertMention = useCallback(
    (mediaId: string, mediaType: 'image' | 'audio', mediaIndex: number) => {
      if (!editor) return;
      editor.chain().focus().insertContent({
        type: 'mediaRef',
        attrs: { mediaId, mediaType, mediaIndex },
      }).insertContent(' ').run();
    },
    [editor]
  );

  return { editor, insertMention, serializePrompt: () => serializePrompt(editor) };
}
