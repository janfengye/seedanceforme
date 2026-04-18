import { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, type Editor } from '@tiptap/react';
import { usePromptEditor } from './usePromptEditor';
import type { UploadedImage, UploadedAudio } from '../../types/index';
import PromptEditorModal from './PromptEditorModal';

interface PromptEditorContextValue {
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
}

export const PromptEditorContext = createContext<PromptEditorContextValue>({
  images: [],
  audioFiles: [],
});

// ── @ Mention Menu (portal, cursor-following) ──

interface AtMenuItem {
  type: 'image' | 'audio';
  id: string;
  index: number;
  label: string;
  sublabel: string;
  previewUrl?: string;
}

function AtMentionMenu({
  editor,
  images,
  audioFiles,
  insertMention,
}: {
  editor: Editor | null;
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
  insertMention: (id: string, type: 'image' | 'audio', index: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const allItems: AtMenuItem[] = [
    ...images.map((img) => ({
      type: 'image' as const,
      id: img.id,
      index: img.index,
      label: `@图${img.index}`,
      sublabel: `参考图 ${img.index}`,
      previewUrl: img.previewUrl,
    })),
    ...audioFiles.map((aud) => ({
      type: 'audio' as const,
      id: aud.id,
      index: aud.index,
      label: `@音频${aud.index}`,
      sublabel: aud.name,
    })),
  ];

  const filteredItems = filter
    ? allItems.filter((item) => item.label.includes(filter) || item.sublabel.includes(filter))
    : allItems;

  const handleInsert = useCallback(
    (item: AtMenuItem) => {
      if (editor) {
        const deleteCount = 1 + filter.length;
        editor.chain().focus()
          .command(({ tr, state }) => {
            const { from } = state.selection;
            tr.delete(from - deleteCount, from);
            return true;
          })
          .run();
      }
      insertMention(item.id, item.type, item.index);
      setShowMenu(false);
      setFilter('');
    },
    [editor, insertMention, filter]
  );

  // Get cursor pixel position from editor
  const updateMenuPosition = useCallback(() => {
    if (!editor) return;
    try {
      const { from } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      setMenuPos({ top: coords.bottom + 4, left: coords.left });
    } catch {
      // fallback
    }
  }, [editor]);

  // Detect @ typed
  useEffect(() => {
    if (!editor) return;
    if (images.length === 0 && audioFiles.length === 0) return;

    const onTransaction = () => {
      const { state } = editor;
      const { from } = state.selection;
      if (from > 0) {
        const charBefore = state.doc.textBetween(from - 1, from);
        if (charBefore === '@' && !showMenu) {
          setShowMenu(true);
          setFilter('');
          setSelectedIndex(0);
          updateMenuPosition();
        }
      }
    };

    editor.on('transaction', onTransaction);
    return () => { editor.off('transaction', onTransaction); };
  }, [editor, images.length, audioFiles.length, showMenu, updateMenuPosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!editor || !showMenu) return;

    const dom = editor.view.dom;

    const onKeydown = (e: Event) => {
      const event = e as KeyboardEvent;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % Math.max(filteredItems.length, 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(filteredItems.length, 1));
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (filteredItems.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          handleInsert(filteredItems[selectedIndex]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setShowMenu(false);
        setFilter('');
      } else if (event.key === 'Backspace') {
        if (filter.length > 0) {
          setFilter((prev) => prev.slice(0, -1));
        } else {
          setShowMenu(false);
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        setFilter((prev) => prev + event.key);
        setSelectedIndex(0);
      }
    };

    dom.addEventListener('keydown', onKeydown, true);
    return () => dom.removeEventListener('keydown', onKeydown, true);
  }, [editor, showMenu, filteredItems, selectedIndex, handleInsert, filter]);

  // Close on outside click
  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showMenu]);

  if (!showMenu || filteredItems.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-[#252838] border border-gray-600 rounded-xl shadow-2xl p-2 min-w-[220px]"
      style={{ top: menuPos.top, left: menuPos.left }}
    >
      {filteredItems.some((i) => i.type === 'image') && (
        <div className="text-xs text-gray-400 px-2 py-1 mb-1">参考图片</div>
      )}
      {filteredItems.map((item, idx) => (
        <div key={item.id}>
          {item.type === 'audio' && idx > 0 && filteredItems[idx - 1]?.type === 'image' && (
            <div className="text-xs text-gray-400 px-2 py-1 mt-1 mb-1">参考音频</div>
          )}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleInsert(item);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
              idx === selectedIndex ? 'bg-purple-500/20' : 'hover:bg-purple-500/20'
            }`}
          >
            {item.type === 'image' && item.previewUrl ? (
              <img src={item.previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
            ) : (
              <svg className="w-8 h-8 text-green-400 p-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
            <span className="text-sm text-purple-400 font-medium">{item.label}</span>
            <span className="text-xs text-gray-500 truncate">{item.sublabel}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Main PromptEditor ──

interface PromptEditorProps {
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
  isGenerating: boolean;
  onSerializedChange: (text: string) => void;
  editorRef?: React.MutableRefObject<ReturnType<typeof usePromptEditor> | null>;
}

export default function PromptEditor({ images, audioFiles, isGenerating, onSerializedChange, editorRef }: PromptEditorProps) {
  const promptEditor = usePromptEditor({ images, audioFiles, isGenerating, onSerializedChange });
  const { editor, insertMention } = promptEditor;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (editorRef) editorRef.current = promptEditor;
  }, [editorRef, promptEditor]);

  const charCount = editor?.storage.characterCount?.characters?.() ?? editor?.getText().length ?? 0;

  return (
    <PromptEditorContext.Provider value={{ images, audioFiles }}>
      <div className="bg-[#1c1f2e] rounded-2xl p-4 border border-gray-800 relative">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-gray-300">提示词</label>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          >
            展开编辑
          </button>
        </div>

        {!showModal && (
          <div className="prompt-editor-container min-h-[100px] max-h-[300px] overflow-y-auto">
            <EditorContent
              editor={editor}
              className="prose prose-invert prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-600 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p]:my-1 [&_.ProseMirror]:text-sm [&_.ProseMirror]:text-gray-200 [&_.ProseMirror]:leading-relaxed"
            />
          </div>
        )}

        <div className="text-right text-xs text-gray-500 mt-2">
          {charCount}/5000
        </div>
      </div>

      {/* @ Menu — works in both inline and modal via portal */}
      <AtMentionMenu
        editor={editor}
        images={images}
        audioFiles={audioFiles}
        insertMention={insertMention}
      />

      {showModal && (
        <PromptEditorModal editor={editor} onClose={() => setShowModal(false)} />
      )}
    </PromptEditorContext.Provider>
  );
}
