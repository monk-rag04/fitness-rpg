import type { ReactNode } from 'react';

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="app-shell">
      <div className="app-content">{children}</div>
    </main>
  );
}
