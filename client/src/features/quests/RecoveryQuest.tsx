import { QuestOrnateFrame, QuestSectionTitle } from '../../components/QuestUi';

export function RecoveryQuest() {
  return (
    <section className="quest-main-content" aria-labelledby="recovery-title">
      <QuestOrnateFrame className="main-quest-frame recovery-main-quest">
        <QuestSectionTitle>メインQUEST</QuestSectionTitle>
        <h2 id="recovery-title">正しく身体を休ませよ</h2>
        <p>
          休むことも強くなるための攻略。<br />
          休養を完了するとAdventure Mapが1マス進みます。
        </p>
      </QuestOrnateFrame>
    </section>
  );
}
