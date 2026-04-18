import { EditorContent, type Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
  onClose: () => void;
}

export default function PromptEditorModal({ editor, onClose }: Props) {
  if (!editor) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1c1f2e] rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-gray-200">编辑提示词</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <EditorContent
            editor={editor}
            className="prose prose-invert prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-600 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p]:my-1 [&_.ProseMirror]:text-sm [&_.ProseMirror]:text-gray-200 [&_.ProseMirror]:leading-relaxed"
          />
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-700">
          <span className="text-xs text-gray-500">{editor.getText().length}/5000</span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
