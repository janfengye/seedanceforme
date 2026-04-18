import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MentionNodeView from './MentionNodeView';

export interface MediaRefAttrs {
  mediaId: string;
  mediaType: 'image' | 'audio';
  mediaIndex: number;
}

const MentionNode = Node.create({
  name: 'mediaRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      mediaId: { default: '' },
      mediaType: { default: 'image' },
      mediaIndex: { default: 1 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-media-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-media-ref': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView);
  },
});

export default MentionNode;
