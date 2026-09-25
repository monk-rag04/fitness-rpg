import type { CharacterScreenModel } from './characterPresentation';

export function BodyGrowthGrid({
  trainingExp,
  recoveryExp,
}: Pick<CharacterScreenModel, 'trainingExp' | 'recoveryExp'>) {
  return (
    <section className="character-growth" aria-labelledby="character-growth-title">
      <h2 id="character-growth-title" className="character-section-title character-section-title--plain">
        <span>BODY GROWTH</span>
      </h2>
      <div className="character-growth-grid">
        {trainingExp.map((item) => (
          <article key={item.id} className="character-exp-card">
            <p className="character-exp-card__label">{item.label}</p>
            <p className="character-exp-card__muscle">{item.japaneseLabel}</p>
            <p className="character-exp-card__value"><strong>{item.exp}</strong><span>EXP</span></p>
          </article>
        ))}
        <article className="character-exp-card character-exp-card--recovery">
          <p className="character-exp-card__label">RECOVERY</p>
          <p className="character-exp-card__muscle">休養</p>
          <p className="character-exp-card__value"><strong>{recoveryExp}</strong><span>EXP</span></p>
        </article>
      </div>
    </section>
  );
}
