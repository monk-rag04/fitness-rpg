import type { ButtonHTMLAttributes, ReactNode } from 'react';

function Corner({ position }: { readonly position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' }) {
  return <span className={`quest-frame-corner quest-frame-corner--${position}`} aria-hidden="true" />;
}

export function QuestOrnateFrame({
  children,
  className = '',
  glow = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly glow?: boolean;
}) {
  return (
    <section className={`quest-ornate-frame ${glow ? 'quest-ornate-frame--glow' : ''} ${className}`}>
      <Corner position="top-left" />
      <Corner position="top-right" />
      <Corner position="bottom-right" />
      <Corner position="bottom-left" />
      {children}
    </section>
  );
}

export function QuestSectionTitle({ children }: { readonly children: ReactNode }) {
  return (
    <div className="quest-section-title">
      <span className="quest-section-title__rule" aria-hidden="true" />
      <h2>{children}</h2>
      <span className="quest-section-title__rule" aria-hidden="true" />
    </div>
  );
}

export function QuestTypeTag({ children }: { readonly children: ReactNode }) {
  return <span className="quest-type-tag"><span aria-hidden="true">✦</span>{children}</span>;
}

export function QuestGoldButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`quest-gold-button ${className}`}>
      {children}
    </button>
  );
}
