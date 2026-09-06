import React from 'react';
import EditorClient from '@/components/editor/EditorClient';

export default function EditorPage() {
  // Render client Editor inside a suspense boundary so hooks like useSearchParams run inside the client.
  return (
    <React.Suspense fallback={<div className="p-8 text-center">Loading editor…</div>}>
      <EditorClient />
    </React.Suspense>
  );
}
