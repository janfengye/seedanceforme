import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface VideoPreviewModalProps {
  videoUrl: string;
  visible: boolean;
  onClose: () => void;
  title?: string;
}

export default function VideoPreviewModal({ videoUrl, visible, onClose, title }: VideoPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.pause();
    }
  }, [visible]);

  if (!visible) return null;

  // Use proxy URL to avoid CORS / referrer issues in browser
  const proxiedUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl mx-4 bg-[#1c1f2e] rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm text-gray-300 truncate">{title || '视频预览'}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {/* Video */}
        {error ? (
          <div className="flex items-center justify-center p-12 text-red-400 text-sm">
            视频加载失败，请尝试刷新或重新从即梦同步
          </div>
        ) : (
          <video
            ref={videoRef}
            src={proxiedUrl}
            controls
            autoPlay
            className="w-full max-h-[80vh]"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---- Hover preview tooltip ---- */
interface VideoHoverPreviewProps {
  videoUrl: string;
  children: React.ReactNode;
}

export function VideoHoverPreview({ videoUrl, children }: VideoHoverPreviewProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const proxiedUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left, y: rect.top });
    timeoutRef.current = window.setTimeout(() => setShow(true), 400);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-flex"
    >
      {children}
      {show && createPortal(
        <div
          className="fixed z-[60] pointer-events-none"
          style={{
            left: Math.min(pos.x, window.innerWidth - 340),
            top: Math.max(pos.y - 200, 8),
          }}
        >
          <div className="w-80 rounded-lg overflow-hidden border border-gray-600 shadow-2xl bg-black">
            <video
              src={proxiedUrl}
              autoPlay
              muted
              loop
              className="w-full"
              preload="metadata"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
