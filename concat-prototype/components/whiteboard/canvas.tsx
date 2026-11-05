"use client";

import { useSyncDemo } from "@tldraw/sync";
import { Tldraw, type Editor } from "tldraw";

export function WhiteboardCanvas({ roomId, onEditorMount }: { roomId: string; onEditorMount: (editor: Editor) => void }) {
  const store = useSyncDemo({ roomId });

  return (
    <div className="shared-board-canvas">
      <Tldraw
        store={store}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
        options={{ deepLinks: true }}
        onMount={onEditorMount}
      />
    </div>
  );
}
