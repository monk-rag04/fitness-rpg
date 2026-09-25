import { PROGRESS_PLACEHOLDER_COPY } from './characterPresentation';

export function ProgressPlaceholder() {
  return (
    <section className="progress-placeholder" aria-labelledby="progress-placeholder-title">
      <header className="progress-placeholder__header">
        <p className="progress-placeholder__eyebrow">ADVENTURER RECORD</p>
        <h1 id="progress-placeholder-title">{PROGRESS_PLACEHOLDER_COPY.title}</h1>
      </header>
      <div className="progress-placeholder__card">
        <span aria-hidden="true">▥</span>
        <p>{PROGRESS_PLACEHOLDER_COPY.message}</p>
      </div>
    </section>
  );
}
