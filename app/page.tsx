// app/page.tsx
import React from 'react';
import dynamic from 'next/dynamic';

// Import the GrpcExplorerApp component dynamically with no SSR
// This is necessary because it uses browser APIs
const GrpcExplorerApp = dynamic(
  () => import('@/components/GrpcExplorerApp'),
                                { ssr: false }
);

export default function Home() {
  return (
    <main>
    <GrpcExplorerApp />
    </main>
  );
}
