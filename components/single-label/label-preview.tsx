"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

interface LabelPreviewProps {
  previewUrl: string | null;
  invalid: boolean;
  onSelect: (file: File) => void;
}

export default function LabelPreview({
  previewUrl,
  invalid,
  onSelect,
}: LabelPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setIsPanning(true);
    viewport.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const start = panRef.current;
    if (!viewport || !start) return;
    viewport.scrollLeft = start.left - (event.clientX - start.x);
    viewport.scrollTop = start.top - (event.clientY - start.y);
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    panRef.current = null;
    setIsPanning(false);
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        id="label-image"
        name="label-image"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden-file-input"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onSelect(selected);
        }}
      />
      {previewUrl ? (
        <div className="preview-shell">
          <div
            ref={viewportRef}
            className={`preview-viewport${isPanning ? " is-panning" : ""}`}
            onPointerDown={beginPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerLeave={endPan}
          >
            {/* A blob URL is generated from a user-selected local file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected label preview"
              className="preview-image"
              draggable={false}
              style={{ height: `${zoom * 100}%` }}
            />
          </div>
          <div className="preview-controls">
            <div
              className="zoom-controls"
              role="group"
              aria-label="Zoom label preview"
            >
              <button
                type="button"
                className="zoom-button"
                onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="zoom-level" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="zoom-button"
                onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="zoom-reset"
                onClick={() => setZoom(1)}
                disabled={zoom === 1}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              className="replace-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload a different label image
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`upload-zone ${invalid ? "field-invalid" : ""}`}
          htmlFor="label-image"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) onSelect(file);
          }}
        >
          <div>
            <strong>Choose label artwork</strong>
            <span>Click here or drop a file into this area</span>
          </div>
        </label>
      )}
    </>
  );
}
