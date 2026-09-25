export function CharacterHero() {
  return (
    <header className="character-hero">
      <p className="character-hero__eyebrow">ADVENTURER STATUS</p>
      <h1 id="character-title" className="character-hero__title">CHARACTER</h1>
      <div className="character-hero__emblem" aria-hidden="true">
        <span>♜</span>
      </div>
      <p className="character-hero__role">ADVENTURER</p>
      <p className="character-hero__tagline">現実の自分を鍛える挑戦者</p>
    </header>
  );
}
