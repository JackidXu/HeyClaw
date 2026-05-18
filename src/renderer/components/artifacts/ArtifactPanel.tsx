import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';

import { i18nService } from '@/services/i18n';
import type { RootState } from '@/store';
import {
  addArtifact,
  ArtifactContentView,
  ArtifactSpecialTab,
  closePanel,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  openArtifactPreviewTab,
  selectActivePreviewTab,
  selectPanelWidth,
  setPanelWidth,
  setPreviewTabContentView,
} from '@/store/slices/artifactSlice';
import type { ArtifactType } from '@/types/artifact';
import type { Artifact } from '@/types/artifact';
import { PREVIEWABLE_ARTIFACT_TYPES } from '@/types/artifact';

import CopyIcon from '../icons/CopyIcon';
import ArtifactRenderer from './ArtifactRenderer';
import FileDirectoryView from './FileDirectoryView';
import CodeRenderer from './renderers/CodeRenderer';

const t = (key: string) => i18nService.t(key);

const BROWSER_OPENABLE_TYPES = new Set<ArtifactType>(['html', 'svg', 'mermaid']);

const SYSTEM_OPENABLE_TYPES = new Set<ArtifactType>(['document']);

const NON_CODE_TYPES = new Set<ArtifactType>(['document', 'image', 'text']);

const COPYABLE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

const PANEL_CLOSE_DRAG_THRESHOLD = 48;
const FILE_LIST_DRAWER_TRANSITION_MS = 180;

function isCopyableArtifact(artifact: Artifact): boolean {
  if (artifact.type === 'document') return false;
  if (artifact.type === 'image') {
    const filename = artifact.fileName || artifact.filePath || '';
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return COPYABLE_IMAGE_EXTENSIONS.has(ext);
  }
  return true;
}

function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert image to blob'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function buildBrowserHtml(artifact: Artifact): string | null {
  switch (artifact.type) {
    case 'html':
      return artifact.content;
    case 'svg':
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.title}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5}</style></head><body>${artifact.content}</body></html>`;
    case 'mermaid':
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.title}</title><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;font-family:system-ui,sans-serif}</style></head><body><pre class="mermaid">${escapeHtml(artifact.content)}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default',securityLevel:'loose'});<\/script></body></html>`;
    default:
      return null;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface ArtifactPanelProps {
  sessionId: string;
  artifacts: Artifact[];
  activeSpecialTab?: ArtifactSpecialTab;
  minPanelWidth?: number;
  maxPanelWidth?: number;
  onOpenFileListTab?: () => void;
  onBrowserAnnotationCaptured?: (payload: BrowserAnnotationPayload) => void;
}

export interface BrowserAnnotationElementInfo {
  tagName: string;
  text: string;
  color: string;
  fontFamily: string;
  width: number;
  height: number;
}

export interface BrowserAnnotationPayload {
  comment: string;
  imageDataUrl: string;
  pageUrl: string;
  pageTitle: string;
  element: BrowserAnnotationElementInfo;
}

const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  sessionId,
  artifacts,
  activeSpecialTab = ArtifactSpecialTab.FileList,
  minPanelWidth = MIN_PANEL_WIDTH,
  maxPanelWidth = MAX_PANEL_WIDTH,
  onOpenFileListTab,
  onBrowserAnnotationCaptured,
}) => {
  const dispatch = useDispatch();
  const panelWidth = useSelector(selectPanelWidth);
  const activePreviewTab = useSelector((state: RootState) => selectActivePreviewTab(state, sessionId));
  const [showFileListDrawer, setShowFileListDrawer] = useState(false);
  const [isFileListDrawerVisible, setIsFileListDrawerVisible] = useState(false);
  const [browserAddress, setBrowserAddress] = useState('');
  const [browserUrl, setBrowserUrl] = useState('');
  const fileListDrawerRef = useRef<HTMLDivElement>(null);
  const fileListButtonRef = useRef<HTMLButtonElement>(null);
  const fileListDrawerAnimationFrameRef = useRef<number | undefined>(undefined);
  const fileListDrawerCloseTimeoutRef = useRef<number | undefined>(undefined);

  const previewableArtifacts = artifacts.filter(a => PREVIEWABLE_ARTIFACT_TYPES.has(a.type));
  const artifactsById = useMemo(() => new Map(artifacts.map(artifact => [artifact.id, artifact])), [artifacts]);
  const selectedArtifact = activePreviewTab ? artifactsById.get(activePreviewTab.artifactId) ?? null : null;
  const selectedArtifactId = selectedArtifact?.id ?? null;
  const activeTab = activePreviewTab?.contentView ?? ArtifactContentView.Preview;
  const isDocumentArtifact = selectedArtifact?.type === 'document';

  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const previousBodyCursor = useRef('');
  const [panelIsResizing, setPanelIsResizing] = useState(false);
  const constrainedMaxPanelWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, maxPanelWidth));
  const constrainedMinPanelWidth = Math.min(
    constrainedMaxPanelWidth,
    Math.max(MIN_PANEL_WIDTH, minPanelWidth),
  );
  const constrainedPanelWidth = Math.max(constrainedMinPanelWidth, Math.min(constrainedMaxPanelWidth, panelWidth));

  const openFileListDrawer = useCallback(() => {
    if (fileListDrawerCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(fileListDrawerCloseTimeoutRef.current);
      fileListDrawerCloseTimeoutRef.current = undefined;
    }
    if (fileListDrawerAnimationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(fileListDrawerAnimationFrameRef.current);
    }

    setShowFileListDrawer(true);
    fileListDrawerAnimationFrameRef.current = window.requestAnimationFrame(() => {
      fileListDrawerAnimationFrameRef.current = undefined;
      setIsFileListDrawerVisible(true);
    });
  }, []);

  const closeFileListDrawer = useCallback(() => {
    if (fileListDrawerAnimationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(fileListDrawerAnimationFrameRef.current);
      fileListDrawerAnimationFrameRef.current = undefined;
    }
    if (fileListDrawerCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(fileListDrawerCloseTimeoutRef.current);
    }

    setIsFileListDrawerVisible(false);
    fileListDrawerCloseTimeoutRef.current = window.setTimeout(() => {
      setShowFileListDrawer(false);
      fileListDrawerCloseTimeoutRef.current = undefined;
    }, FILE_LIST_DRAWER_TRANSITION_MS);
  }, []);

  const toggleFileListDrawer = useCallback(() => {
    if (showFileListDrawer && isFileListDrawerVisible) {
      closeFileListDrawer();
      return;
    }

    openFileListDrawer();
  }, [closeFileListDrawer, isFileListDrawerVisible, openFileListDrawer, showFileListDrawer]);

  const handleResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = constrainedPanelWidth;
    previousBodyCursor.current = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
    setPanelIsResizing(true);

    const stopResizing = () => {
      isResizing.current = false;
      document.body.style.cursor = previousBodyCursor.current;
      document.body.classList.remove('select-none');
      setPanelIsResizing(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isResizing.current) return;
      moveEvent.preventDefault();
      const nextWidth = startWidth.current + startX.current - moveEvent.clientX;
      if (nextWidth < constrainedMinPanelWidth - PANEL_CLOSE_DRAG_THRESHOLD) {
        stopResizing();
        dispatch(closePanel({ sessionId }));
        return;
      }
      const clampedWidth = Math.max(
        constrainedMinPanelWidth,
        Math.min(constrainedMaxPanelWidth, nextWidth),
      );
      dispatch(setPanelWidth(clampedWidth));
    };

    const handlePointerUp = () => {
      stopResizing();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
  }, [constrainedMaxPanelWidth, constrainedMinPanelWidth, constrainedPanelWidth, dispatch, sessionId]);

  useEffect(() => {
    return () => {
      if (fileListDrawerAnimationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(fileListDrawerAnimationFrameRef.current);
      }
      if (fileListDrawerCloseTimeoutRef.current !== undefined) {
        window.clearTimeout(fileListDrawerCloseTimeoutRef.current);
      }
      document.body.style.cursor = previousBodyCursor.current;
      document.body.classList.remove('select-none');
    };
  }, []);

  useEffect(() => {
    if (selectedArtifact) return;
    closeFileListDrawer();
  }, [closeFileListDrawer, selectedArtifact]);

  useEffect(() => {
    closeFileListDrawer();
  }, [activePreviewTab?.id, closeFileListDrawer]);

  useEffect(() => {
    if (!showFileListDrawer) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (fileListDrawerRef.current?.contains(target) || fileListButtonRef.current?.contains(target)) {
        return;
      }
      closeFileListDrawer();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFileListDrawer();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeFileListDrawer, showFileListDrawer]);

  // Auto-refresh when the previewed file changes on disk
  useEffect(() => {
    const filePath = selectedArtifact?.filePath;
    if (!filePath) return;

    let cleanup: (() => void) | undefined;
    let watchedPath: string | null = null;

    window.electron?.artifact?.watchFile(filePath);
    watchedPath = filePath;

    cleanup = window.electron?.artifact?.onFileChanged(({ filePath: changedPath }) => {
      if (changedPath === watchedPath) {
        handleRefreshRef.current();
      }
    });

    return () => {
      if (cleanup) cleanup();
      if (watchedPath) window.electron?.artifact?.unwatchFile(watchedPath);
    };
  }, [selectedArtifact?.filePath]);

  const handleSelectArtifact = useCallback((id: string) => {
    onOpenFileListTab?.();
    dispatch(openArtifactPreviewTab({ sessionId, artifactId: id }));
  }, [dispatch, onOpenFileListTab, sessionId]);

  const handleSelectArtifactFromDrawer = useCallback((id: string) => {
    dispatch(openArtifactPreviewTab({ sessionId, artifactId: id }));
    closeFileListDrawer();
  }, [closeFileListDrawer, dispatch, sessionId]);

  const handleSetContentView = useCallback((contentView: ArtifactContentView) => {
    if (!activePreviewTab) return;
    dispatch(setPreviewTabContentView({
      sessionId,
      tabId: activePreviewTab.id,
      contentView,
    }));
  }, [activePreviewTab, dispatch, sessionId]);

  const handleCopy = useCallback(async () => {
    if (!selectedArtifact) return;
    if (selectedArtifact.type === 'image') {
      if (selectedArtifact.filePath) {
        const result = await window.electron?.clipboard?.writeImageFromFile(selectedArtifact.filePath);
        if (!result?.success) {
          window.dispatchEvent(new CustomEvent('app:showToast', { detail: result?.error || t('copyFailed') }));
          return;
        }
      } else if (selectedArtifact.content) {
        const blob = await dataUrlToPngBlob(selectedArtifact.content);
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      }
    } else {
      await navigator.clipboard.writeText(selectedArtifact.content);
    }
    window.dispatchEvent(new CustomEvent('app:showToast', { detail: t('messageCopied') }));
  }, [selectedArtifact]);

  const handleRevealInFolder = useCallback(() => {
    if (!selectedArtifact?.filePath) return;
    window.electron?.shell?.showItemInFolder(selectedArtifact.filePath);
  }, [selectedArtifact]);

  const handleOpenInBrowser = useCallback(() => {
    if (!selectedArtifact) return;

    // Mermaid needs HTML wrapper with mermaid.js to render in browser
    if (selectedArtifact.type === 'mermaid') {
      if (!selectedArtifact.content) return;
      const html = buildBrowserHtml(selectedArtifact);
      if (html) {
        window.electron?.shell?.openHtmlInBrowser(html);
      }
      return;
    }

    // Has file on disk: open directly via native path
    // NOTE: shell.openExternal with file:// URLs fails on Windows when path contains
    // non-ASCII characters (e.g. Chinese) — ERROR_FILE_NOT_FOUND (0x2).
    // Use shell.openPath which handles native Unicode paths correctly.
    if (selectedArtifact.filePath) {
      window.electron?.shell?.openPath(selectedArtifact.filePath);
      return;
    }

    // No file path: generate HTML and open via temp file
    if (!selectedArtifact.content) return;
    const html = buildBrowserHtml(selectedArtifact);
    if (html) {
      window.electron?.shell?.openHtmlInBrowser(html);
    }
  }, [selectedArtifact]);

  const handleOpenWithApp = useCallback(() => {
    if (selectedArtifact?.filePath) {
      let filePath = selectedArtifact.filePath;
      if (filePath.startsWith('file:///')) {
        filePath = filePath.slice(7);
      } else if (filePath.startsWith('file://')) {
        filePath = filePath.slice(7);
      } else if (filePath.startsWith('file:/')) {
        filePath = filePath.slice(5);
      }
      // Strip leading / before Windows drive letter
      if (/^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
      window.electron?.shell?.openPath(filePath);
    }
  }, [selectedArtifact]);

  const handleRefresh = useCallback(async () => {
    if (!selectedArtifact?.filePath) return;
    try {
      const result = await window.electron.dialog.readFileAsDataUrl(selectedArtifact.filePath);
      if (result?.success && result.dataUrl) {
        const isTextType = selectedArtifact.type !== 'image' && selectedArtifact.type !== 'document';
        let content = result.dataUrl;
        if (isTextType) {
          try {
            const base64 = result.dataUrl.split(',')[1] || '';
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            content = new TextDecoder('utf-8').decode(bytes);
          } catch {
            content = result.dataUrl;
          }
        }
        dispatch(addArtifact({
          sessionId: selectedArtifact.sessionId,
          artifact: { ...selectedArtifact, content },
        }));
      }
    } catch {
      // File unreadable or missing
    }
  }, [selectedArtifact, dispatch]);

  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  return (
    <>
      {/* Drag handle */}
      <div
        className="w-1 shrink-0 touch-none cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        onPointerDown={handleResizeStart}
      />
      <aside
        style={{ width: constrainedPanelWidth, maxWidth: constrainedMaxPanelWidth }}
        className="shrink border-l border-border bg-background flex flex-col h-full overflow-hidden relative"
      >
        {panelIsResizing && (
          <div className="absolute inset-0 z-30 cursor-col-resize bg-transparent" />
        )}

        {selectedArtifact ? (
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Header: current file + actions */}
            <div className="h-10 flex items-center gap-2 px-3 border-b border-border shrink-0">
              <span className="text-sm font-medium truncate">{selectedArtifact.fileName || selectedArtifact.title}</span>
              <span className="text-xs uppercase text-muted">{selectedArtifact.type}</span>
              <span className="flex-1" />
              {selectedArtifact.filePath && (
                <button
                  onClick={handleRefresh}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactRefresh')}
                >
                  <RefreshIcon />
                </button>
              )}
              {isCopyableArtifact(selectedArtifact) && (
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactCopyCode')}
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {BROWSER_OPENABLE_TYPES.has(selectedArtifact.type) && (
                <button
                  onClick={handleOpenInBrowser}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenInBrowser')}
                >
                  <BrowserIcon />
                </button>
              )}
              {SYSTEM_OPENABLE_TYPES.has(selectedArtifact.type) && selectedArtifact.filePath && (
                <button
                  onClick={handleOpenWithApp}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenWithApp')}
                >
                  <OpenExternalIcon />
                </button>
              )}
              {selectedArtifact.filePath && (
                <button
                  onClick={handleRevealInFolder}
                  className="p-1 rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  title={t('artifactOpenFolder')}
                >
                  <FolderIcon />
                </button>
              )}
              <button
                ref={fileListButtonRef}
                onClick={toggleFileListDrawer}
                className={`p-1 rounded transition-colors ${
                  isFileListDrawerVisible
                    ? 'text-primary bg-primary/10'
                    : 'text-secondary hover:text-foreground hover:bg-surface'
                }`}
                title={t('artifactFileList')}
              >
                <FileListIcon />
              </button>
            </div>

            {showFileListDrawer && (
              <div
                ref={fileListDrawerRef}
                className={`absolute top-10 right-0 bottom-0 z-20 flex w-[min(320px,86%)] flex-col border-l border-border bg-background shadow-xl transition-[transform,opacity] duration-[180ms] ease-out motion-reduce:transition-none ${
                  isFileListDrawerVisible
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-full opacity-0 pointer-events-none'
                }`}
              >
                <div className="h-9 flex items-center px-3 border-b border-border shrink-0">
                  <span className="text-xs font-medium text-secondary">{t('artifactFileList')}</span>
                </div>
                <FileDirectoryView
                  artifacts={previewableArtifacts}
                  selectedId={selectedArtifactId}
                  onSelect={handleSelectArtifactFromDrawer}
                  compact
                />
              </div>
            )}

            {/* Preview/Code tabs */}
            <div className={`flex border-b border-border shrink-0 ${isDocumentArtifact ? 'pl-4' : ''}`}>
              <button
                onClick={() => handleSetContentView(ArtifactContentView.Preview)}
                className={`${isDocumentArtifact ? 'px-0' : 'px-3'} py-1.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === ArtifactContentView.Preview
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-foreground'
                }`}
              >
                {t('artifactPreview')}
              </button>
              {!NON_CODE_TYPES.has(selectedArtifact.type) && (
                <button
                  onClick={() => handleSetContentView(ArtifactContentView.Code)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === ArtifactContentView.Code
                      ? 'border-primary text-primary'
                      : 'border-transparent text-secondary hover:text-foreground'
                  }`}
                >
                  {t('artifactCode')}
                </button>
              )}
            </div>

            {/* Render area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === ArtifactContentView.Preview ? (
                <ArtifactRenderer artifact={selectedArtifact} sessionArtifacts={artifacts} />
              ) : (
                <CodeRenderer artifact={selectedArtifact} />
              )}
            </div>
          </div>
        ) : activeSpecialTab === ArtifactSpecialTab.Browser ? (
          <BrowserTabContent
            address={browserAddress}
            currentUrl={browserUrl}
            onAddressChange={setBrowserAddress}
            onCurrentUrlChange={setBrowserUrl}
            onAnnotationCaptured={onBrowserAnnotationCaptured}
          />
        ) : (
          /* No artifact selected: show full-width file list */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <FileDirectoryView
              artifacts={previewableArtifacts}
              selectedId={selectedArtifactId}
              onSelect={handleSelectArtifact}
            />
          </div>
        )}
      </aside>
    </>
  );
};

type BrowserWebviewElement = HTMLElement & {
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  capturePage?: () => Promise<{ toDataURL: () => string }>;
  executeJavaScript?: (code: string) => Promise<unknown>;
  goBack?: () => void;
  goForward?: () => void;
  reload?: () => void;
  stop?: () => void;
  getURL?: () => string;
};

const BrowserScreenshotStatus = {
  Idle: 'idle',
  Copied: 'copied',
  Error: 'error',
} as const;

type BrowserScreenshotStatus = typeof BrowserScreenshotStatus[keyof typeof BrowserScreenshotStatus];

const BrowserAnnotationStatus = {
  Sent: 'sent',
  Cancelled: 'cancelled',
} as const;

type BrowserAnnotationStatus = typeof BrowserAnnotationStatus[keyof typeof BrowserAnnotationStatus];

const BrowserToolbarAction = {
  Annotate: 'annotate',
  Screenshot: 'screenshot',
  OpenExternal: 'openExternal',
} as const;

type BrowserToolbarAction = typeof BrowserToolbarAction[keyof typeof BrowserToolbarAction];

interface BrowserToolbarTooltipPosition {
  left: number;
  top: number;
  placement: 'top' | 'bottom';
}

interface BrowserAnnotationResult {
  status: BrowserAnnotationStatus;
  comment?: string;
  pageUrl?: string;
  pageTitle?: string;
  element?: BrowserAnnotationElementInfo;
}

function normalizeBrowserUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?|file):\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

interface BrowserAnnotationLabels {
  instruction: string;
  placeholder: string;
  send: string;
  cancel: string;
  tag: string;
  size: string;
  color: string;
  font: string;
  statusSent: BrowserAnnotationStatus;
  statusCancelled: BrowserAnnotationStatus;
}

function buildBrowserAnnotationScript(labels: BrowserAnnotationLabels): string {
  return `
(() => {
  const labels = ${JSON.stringify(labels)};
  if (window.__lobsterAnnotationCleanup) {
    window.__lobsterAnnotationCleanup();
  }

  const overlayRoot = document.createElement('div');
  overlayRoot.setAttribute('data-lobster-annotation-ui', 'true');
  overlayRoot.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

  const highlight = document.createElement('div');
  highlight.style.cssText = 'position:fixed;display:none;box-sizing:border-box;border:2px solid #1683ff;background:rgba(22,131,255,0.08);box-shadow:0 0 0 1px rgba(255,255,255,0.9);pointer-events:none;';

  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:fixed;display:none;max-width:260px;border-radius:8px;background:rgba(18,18,22,0.94);color:#fff;padding:8px 10px;font-size:12px;line-height:1.4;box-shadow:0 8px 22px rgba(0,0,0,0.28);pointer-events:none;';

  const composer = document.createElement('div');
  composer.setAttribute('data-lobster-annotation-ui', 'true');
  composer.style.cssText = 'position:fixed;display:none;min-width:300px;max-width:380px;border-radius:18px;background:rgba(22,22,24,0.96);color:#fff;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,0.28);pointer-events:auto;gap:8px;align-items:center;';

  const textarea = document.createElement('textarea');
  textarea.placeholder = labels.placeholder;
  textarea.rows = 1;
  textarea.style.cssText = 'min-width:0;flex:1;height:36px;max-height:96px;resize:none;border:0;outline:none;border-radius:12px;background:transparent;color:#fff;padding:8px 10px;font:13px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

  const sendButton = document.createElement('button');
  sendButton.type = 'button';
  sendButton.textContent = '✓';
  sendButton.title = labels.send;
  sendButton.style.cssText = 'width:36px;height:36px;border:0;border-radius:999px;background:#fff;color:#111;font-size:20px;line-height:1;cursor:pointer;';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = '×';
  cancelButton.title = labels.cancel;
  cancelButton.style.cssText = 'width:30px;height:30px;border:0;border-radius:999px;background:transparent;color:#c8c8c8;font-size:20px;line-height:1;cursor:pointer;';

  composer.append(textarea, sendButton, cancelButton);
  overlayRoot.append(highlight, tooltip, composer);
  document.documentElement.appendChild(overlayRoot);

  let selectedInfo = null;
  let frozen = false;
  let resolved = false;
  let resolvePromise;

  const cleanup = () => {
    if (!resolved) {
      finish({ status: labels.statusCancelled });
    }
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    overlayRoot.remove();
    delete window.__lobsterAnnotationCleanup;
  };

  const finish = (result) => {
    if (resolved) return;
    resolved = true;
    resolvePromise(result);
  };

  const isAnnotationUi = (target) => target?.closest?.('[data-lobster-annotation-ui="true"]');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const cleanText = (value) => (value || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
  const formatFont = (value) => cleanText(value).split(',')[0].replace(/["']/g, '').slice(0, 42);

  const readInfo = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const tagName = element.tagName ? element.tagName.toLowerCase() : 'element';
    const elementText = element.getAttribute('aria-label') || element.getAttribute('alt') || element.innerText || element.textContent || '';
    return {
      tagName,
      text: cleanText(elementText),
      color: style.color || '',
      fontFamily: formatFont(style.fontFamily || ''),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  };

  const renderHighlight = (info) => {
    const rect = info.rect;
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
  };

  const renderTooltip = (info) => {
    const rect = info.rect;
    tooltip.innerHTML = [
      '<div style="display:flex;gap:12px;justify-content:space-between;"><strong>' + info.tagName + '</strong><span>' + info.width + '×' + info.height + '</span></div>',
      '<div style="display:grid;grid-template-columns:auto 1fr;column-gap:10px;margin-top:4px;color:#d6d6d6;"><span>' + labels.color + '</span><strong style="color:#fff;font-weight:600;">' + (info.color || '-') + '</strong><span>' + labels.font + '</span><strong style="color:#fff;font-weight:600;">' + (info.fontFamily || '-') + '</strong></div>',
      info.text ? '<div style="margin-top:4px;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + info.text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) + '</div>' : ''
    ].join('');
    tooltip.style.display = 'block';
    tooltip.style.left = clamp(rect.left, 8, window.innerWidth - 270) + 'px';
    tooltip.style.top = clamp(rect.top - tooltip.offsetHeight - 10, 8, window.innerHeight - tooltip.offsetHeight - 8) + 'px';
  };

  const renderComposer = (info) => {
    const rect = info.rect;
    composer.style.display = 'flex';
    composer.style.left = clamp(rect.left + Math.min(100, rect.width / 2), 8, window.innerWidth - 388) + 'px';
    composer.style.top = clamp(rect.top + Math.min(32, rect.height / 2), 8, window.innerHeight - 72) + 'px';
    textarea.focus();
  };

  function handleMouseMove(event) {
    if (frozen || isAnnotationUi(event.target)) return;
    const element = event.target;
    if (!(element instanceof Element)) return;
    const info = readInfo(element);
    if (info.width <= 0 || info.height <= 0) return;
    selectedInfo = info;
    renderHighlight(info);
    renderTooltip(info);
  }

  function handleClick(event) {
    if (isAnnotationUi(event.target)) return;
    if (!selectedInfo) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    frozen = true;
    tooltip.style.display = 'none';
    renderHighlight(selectedInfo);
    renderComposer(selectedInfo);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish({ status: labels.statusCancelled });
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && selectedInfo) {
      event.preventDefault();
      sendButton.click();
    }
  }

  sendButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedInfo) return;
    composer.style.display = 'none';
    const { rect, ...element } = selectedInfo;
    finish({
      status: labels.statusSent,
      comment: textarea.value.trim(),
      pageUrl: location.href,
      pageTitle: document.title || '',
      element,
    });
  });

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    finish({ status: labels.statusCancelled });
  });

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.__lobsterAnnotationCleanup = cleanup;

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
})()
`;
}

interface BrowserTabContentProps {
  address: string;
  currentUrl: string;
  onAddressChange: (value: string) => void;
  onCurrentUrlChange: (value: string) => void;
  onAnnotationCaptured?: (payload: BrowserAnnotationPayload) => void;
}

const BrowserTabContent: React.FC<BrowserTabContentProps> = ({
  address,
  currentUrl,
  onAddressChange,
  onCurrentUrlChange,
  onAnnotationCaptured,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<BrowserScreenshotStatus>(BrowserScreenshotStatus.Idle);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [hoveredToolbarAction, setHoveredToolbarAction] = useState<BrowserToolbarAction | null>(null);
  const [toolbarTooltipPosition, setToolbarTooltipPosition] = useState<BrowserToolbarTooltipPosition | null>(null);
  const [webviewNode, setWebviewNode] = useState<BrowserWebviewElement | null>(null);
  const annotateButtonRef = useRef<HTMLDivElement>(null);
  const screenshotButtonRef = useRef<HTMLDivElement>(null);
  const openExternalButtonRef = useRef<HTMLDivElement>(null);
  const screenshotStatusTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (screenshotStatusTimeoutRef.current !== undefined) {
      window.clearTimeout(screenshotStatusTimeoutRef.current);
    }
  }, []);

  const syncNavigationState = useCallback((node: BrowserWebviewElement | null) => {
    if (!node) return;
    setCanGoBack(node.canGoBack?.() ?? false);
    setCanGoForward(node.canGoForward?.() ?? false);
    const nextUrl = node.getURL?.();
    if (nextUrl && nextUrl !== 'about:blank') {
      onCurrentUrlChange(nextUrl);
      onAddressChange(nextUrl);
    }
  }, [onAddressChange, onCurrentUrlChange]);

  const getToolbarActionElement = useCallback((action: BrowserToolbarAction): HTMLDivElement | null => {
    switch (action) {
      case BrowserToolbarAction.Annotate:
        return annotateButtonRef.current;
      case BrowserToolbarAction.Screenshot:
        return screenshotButtonRef.current;
      case BrowserToolbarAction.OpenExternal:
        return openExternalButtonRef.current;
      default:
        return null;
    }
  }, []);

  useLayoutEffect(() => {
    if (!hoveredToolbarAction) {
      setToolbarTooltipPosition(null);
      return;
    }

    const updatePosition = () => {
      const element = getToolbarActionElement(hoveredToolbarAction);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const placement = rect.top >= 34 ? 'top' : 'bottom';
      const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
      const left = Math.max(8, Math.min(window.innerWidth - 8, rect.left + rect.width / 2));
      setToolbarTooltipPosition({ left, top, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [getToolbarActionElement, hoveredToolbarAction]);

  useEffect(() => {
    if (!webviewNode) return;

    const handleStartLoading = () => setIsLoading(true);
    const handleStopLoading = () => {
      setIsLoading(false);
      syncNavigationState(webviewNode);
    };
    const handleNavigate = (event: Event) => {
      const nextUrl = (event as Event & { url?: string }).url;
      if (nextUrl && nextUrl !== 'about:blank') {
        onCurrentUrlChange(nextUrl);
        onAddressChange(nextUrl);
      }
      syncNavigationState(webviewNode);
    };

    webviewNode.addEventListener('did-start-loading', handleStartLoading);
    webviewNode.addEventListener('did-stop-loading', handleStopLoading);
    webviewNode.addEventListener('did-navigate', handleNavigate);
    webviewNode.addEventListener('did-navigate-in-page', handleNavigate);
    webviewNode.addEventListener('dom-ready', handleStopLoading);
    return () => {
      webviewNode.removeEventListener('did-start-loading', handleStartLoading);
      webviewNode.removeEventListener('did-stop-loading', handleStopLoading);
      webviewNode.removeEventListener('did-navigate', handleNavigate);
      webviewNode.removeEventListener('did-navigate-in-page', handleNavigate);
      webviewNode.removeEventListener('dom-ready', handleStopLoading);
    };
  }, [onAddressChange, onCurrentUrlChange, syncNavigationState, webviewNode]);

  const handleNavigate = useCallback(() => {
    const nextUrl = normalizeBrowserUrl(address);
    if (!nextUrl) return;
    onCurrentUrlChange(nextUrl);
    onAddressChange(nextUrl);
  }, [address, onAddressChange, onCurrentUrlChange]);

  const handleAddressKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleNavigate();
    }
  }, [handleNavigate]);

  const handleOpenExternal = useCallback(() => {
    if (!currentUrl) return;
    window.electron?.shell?.openExternal(currentUrl);
  }, [currentUrl]);

  const setTemporaryScreenshotStatus = useCallback((status: BrowserScreenshotStatus) => {
    setScreenshotStatus(status);
    if (screenshotStatusTimeoutRef.current !== undefined) {
      window.clearTimeout(screenshotStatusTimeoutRef.current);
    }
    screenshotStatusTimeoutRef.current = window.setTimeout(() => {
      setScreenshotStatus(BrowserScreenshotStatus.Idle);
      screenshotStatusTimeoutRef.current = undefined;
    }, 1600);
  }, []);

  const handleCaptureScreenshot = useCallback(async () => {
    if (!webviewNode?.capturePage || !currentUrl || isCapturingScreenshot) return;
    setIsCapturingScreenshot(true);
    try {
      const image = await webviewNode.capturePage();
      const result = await window.electron?.clipboard?.writeImageFromDataUrl(image.toDataURL());
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to write browser screenshot to clipboard');
      }
      setTemporaryScreenshotStatus(BrowserScreenshotStatus.Copied);
    } catch {
      setTemporaryScreenshotStatus(BrowserScreenshotStatus.Error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [currentUrl, isCapturingScreenshot, setTemporaryScreenshotStatus, webviewNode]);

  const handleToggleAnnotation = useCallback(async () => {
    if (!webviewNode?.executeJavaScript || !webviewNode.capturePage || !currentUrl) return;
    if (isAnnotating) {
      await webviewNode.executeJavaScript('window.__lobsterAnnotationCleanup?.()').catch(() => undefined);
      setIsAnnotating(false);
      return;
    }
    setIsAnnotating(true);
    try {
      const labels: BrowserAnnotationLabels = {
        instruction: t('artifactBrowserAnnotationInstruction'),
        placeholder: t('artifactBrowserAnnotationPlaceholder'),
        send: t('artifactBrowserAnnotationSend'),
        cancel: t('artifactBrowserAnnotationCancel'),
        tag: t('artifactBrowserAnnotationLabelTag'),
        size: t('artifactBrowserAnnotationLabelSize'),
        color: t('artifactBrowserAnnotationLabelColor'),
        font: t('artifactBrowserAnnotationLabelFont'),
        statusSent: BrowserAnnotationStatus.Sent,
        statusCancelled: BrowserAnnotationStatus.Cancelled,
      };
      const result = await webviewNode.executeJavaScript(buildBrowserAnnotationScript(labels)) as BrowserAnnotationResult | undefined;
      if (result?.status !== BrowserAnnotationStatus.Sent || !result.element) return;

      await new Promise(resolve => window.setTimeout(resolve, 80));
      const image = await webviewNode.capturePage();
      onAnnotationCaptured?.({
        comment: result.comment?.trim() ?? '',
        imageDataUrl: image.toDataURL(),
        pageUrl: result.pageUrl || currentUrl,
        pageTitle: result.pageTitle || '',
        element: result.element,
      });
    } catch {
      window.dispatchEvent(new CustomEvent('app:showToast', {
        detail: t('artifactBrowserScreenshotFailed'),
      }));
    } finally {
      await webviewNode?.executeJavaScript?.('window.__lobsterAnnotationCleanup?.()').catch(() => undefined);
      setIsAnnotating(false);
    }
  }, [currentUrl, isAnnotating, onAnnotationCaptured, webviewNode]);

  const screenshotButtonTitle =
    screenshotStatus === BrowserScreenshotStatus.Copied
      ? t('artifactBrowserScreenshotCopied')
      : screenshotStatus === BrowserScreenshotStatus.Error
        ? t('artifactBrowserScreenshotFailed')
        : t('artifactBrowserScreenshot');

  const hoveredToolbarLabel =
    hoveredToolbarAction === BrowserToolbarAction.Annotate
      ? t('artifactBrowserAnnotate')
      : hoveredToolbarAction === BrowserToolbarAction.Screenshot
        ? t('artifactBrowserScreenshot')
        : hoveredToolbarAction === BrowserToolbarAction.OpenExternal
          ? t('artifactBrowserOpenExternal')
          : '';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <button
          type="button"
          onClick={() => webviewNode?.goBack?.()}
          disabled={!canGoBack}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          title={t('artifactBrowserBack')}
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button"
          onClick={() => webviewNode?.goForward?.()}
          disabled={!canGoForward}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          title={t('artifactBrowserForward')}
        >
          <ChevronRightBrowserIcon />
        </button>
        <button
          type="button"
          onClick={() => (isLoading ? webviewNode?.stop?.() : webviewNode?.reload?.())}
          disabled={!currentUrl}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          title={isLoading ? t('artifactBrowserStop') : t('artifactBrowserReload')}
        >
          {isLoading ? <StopIcon /> : <RefreshIcon />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2 focus-within:border-primary">
          <BrowserIcon />
          <input
            type="text"
            value={address}
            onChange={event => onAddressChange(event.target.value)}
            onKeyDown={handleAddressKeyDown}
            placeholder={t('artifactBrowserUrlPlaceholder')}
            className="h-7 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </div>
        <div
          ref={annotateButtonRef}
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          onMouseEnter={() => setHoveredToolbarAction(BrowserToolbarAction.Annotate)}
          onMouseLeave={() => setHoveredToolbarAction(null)}
        >
          <button
            type="button"
            onClick={handleToggleAnnotation}
            disabled={!currentUrl}
            className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              isAnnotating
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-surface hover:text-foreground'
            }`}
            aria-label={t('artifactBrowserAnnotate')}
            title={isAnnotating ? t('artifactBrowserAnnotating') : t('artifactBrowserAnnotate')}
          >
            <AnnotateIcon />
          </button>
        </div>
        {isAnnotating && (
          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
            {t('artifactBrowserAnnotating')}
          </span>
        )}
        <div
          ref={screenshotButtonRef}
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          onMouseEnter={() => setHoveredToolbarAction(BrowserToolbarAction.Screenshot)}
          onMouseLeave={() => setHoveredToolbarAction(null)}
        >
          <button
            type="button"
            onClick={handleCaptureScreenshot}
            disabled={!currentUrl || isCapturingScreenshot}
            className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              screenshotStatus === BrowserScreenshotStatus.Copied
                ? 'text-primary hover:bg-surface'
                : screenshotStatus === BrowserScreenshotStatus.Error
                  ? 'text-red-500 hover:bg-surface'
                  : 'text-secondary hover:bg-surface hover:text-foreground'
            }`}
            aria-label={t('artifactBrowserScreenshot')}
            title={screenshotButtonTitle}
          >
            {screenshotStatus === BrowserScreenshotStatus.Copied ? <ScreenshotCopiedIcon /> : <ScreenshotIcon />}
          </button>
        </div>
        <div
          ref={openExternalButtonRef}
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          onMouseEnter={() => setHoveredToolbarAction(BrowserToolbarAction.OpenExternal)}
          onMouseLeave={() => setHoveredToolbarAction(null)}
        >
          <button
            type="button"
            onClick={handleOpenExternal}
            disabled={!currentUrl}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={t('artifactBrowserOpenExternal')}
            title={t('artifactBrowserOpenExternal')}
          >
            <BrowserIcon />
          </button>
        </div>
      </div>
      {hoveredToolbarLabel && toolbarTooltipPosition && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] leading-none text-background shadow-sm"
          style={{
            left: toolbarTooltipPosition.left,
            top: toolbarTooltipPosition.top,
            transform: toolbarTooltipPosition.placement === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          {hoveredToolbarLabel}
        </div>,
        document.body,
      )}
      {currentUrl ? (
        React.createElement('webview', {
          ref: (node: BrowserWebviewElement | null) => setWebviewNode(node),
          src: currentUrl,
          partition: 'persist:lobster-artifact-browser',
          className: 'min-h-0 flex-1 bg-white',
          allowpopups: 'false',
        })
      ) : (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted">
          {t('artifactBrowserEmpty')}
        </div>
      )}
    </div>
  );
};

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5A1.5 1.5 0 013.5 3h2.879a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
  </svg>
);

const BrowserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <ellipse cx="8" cy="8" rx="2.5" ry="6" />
    <path d="M2 8h12" />
  </svg>
);

const AnnotateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.25 3.25h9.5A1.75 1.75 0 0114.5 5v5.25A1.75 1.75 0 0112.75 12H8.4L4.75 14v-2H3.25A1.75 1.75 0 011.5 10.25V5a1.75 1.75 0 011.75-1.75z" />
    <path d="M8 5.75v3.5M6.25 7.5h3.5" />
  </svg>
);

const ScreenshotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.25 4.25l.55-1.1A1.5 1.5 0 017.14 2.3h1.72a1.5 1.5 0 011.34.85l.55 1.1h1.75A1.5 1.5 0 0114 5.75v6A1.5 1.5 0 0112.5 13h-9A1.5 1.5 0 012 11.75v-6a1.5 1.5 0 011.5-1.5h1.75z" />
    <circle cx="8" cy="8.6" r="2.3" />
  </svg>
);

const ScreenshotCopiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.2l3 3 6-6.4" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3L5 8l5 5" />
  </svg>
);

const ChevronRightBrowserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.25 4.25h7.5v7.5h-7.5z" />
  </svg>
);

const OpenExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v3.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 12.5v-7A1.5 1.5 0 013.5 4H7" />
    <path d="M10 2h4v4" />
    <path d="M7 9l7-7" />
  </svg>
);

const FileListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 2.881c0-.644.522-1.167 1.167-1.167h2.552c.323 0 .635.117.878.33l.58.507c.243.213.555.33.877.33h3.351c.736 0 1.333.597 1.333 1.333v5.945c0 .49-.398.889-.889.889" />
    <path d="M1.143 6.476c0-.736.597-1.333 1.333-1.333h2.314c.323 0 .635.117.878.33l.58.507c.242.213.554.33.877.33h3.351c.736 0 1.333.597 1.333 1.334v4.833c0 .736-.597 1.333-1.333 1.333H2.476c-.736 0-1.333-.597-1.333-1.333V6.476z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 01-9.55 3.75" />
    <path d="M2.5 8a5.5 5.5 0 019.55-3.75" />
    <path d="M12.05 1.25v3h-3" />
    <path d="M3.95 14.75v-3h3" />
  </svg>
);

export default ArtifactPanel;
