import { NodeViewWrapper } from '@tiptap/react';
import { useState, useContext } from 'react';
import { PromptEditorContext } from './PromptEditor';

export default function MentionNodeView({ node }: { node: any }) {
  const { images, audioFiles } = useContext(PromptEditorContext);
  const { mediaId, mediaType, mediaIndex } = node.attrs;
  const [showPreview, setShowPreview] = useState(false);

  if (mediaType === 'image') {
    const img = images.find((i) => i.id === mediaId);
    if (!img) return <NodeViewWrapper as="span" />;

    return (
      <NodeViewWrapper
        as="span"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-sm cursor-default mx-0.5 relative"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        <img src={img.previewUrl} alt="" className="w-4 h-4 rounded object-cover" />
        <span>@图{mediaIndex}</span>
        {showPreview && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
            <img
              src={img.previewUrl}
              alt=""
              className="w-[200px] h-[200px] object-cover rounded-lg border border-gray-600 shadow-2xl"
            />
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  // Audio chip
  const aud = audioFiles.find((a) => a.id === mediaId);
  if (!aud) return <NodeViewWrapper as="span" />;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-sm cursor-default mx-0.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
      <span>@音频{mediaIndex}</span>
    </NodeViewWrapper>
  );
}
