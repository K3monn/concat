"use client";

import { Tldraw } from "tldraw";

interface CanvasProps {
  onCanvasChange?: (svgOrSnapshot: unknown) => void;
}

export function WhiteboardCanvas({ onCanvasChange }: CanvasProps) {
  return (
    <div className="w-full h-full relative min-h-[500px] border rounded-lg overflow-hidden">
      <Tldraw
        onMount={(editor) => {
          editor.sideEffects.registerBeforeChangeHandler("shape", (_prev, next) => {
            onCanvasChange?.(editor.getSnapshot());
            return next;
          });
        }}
      />
    </div>
  );
}