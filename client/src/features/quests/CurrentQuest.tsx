import { useEffect, useState } from 'react';
import {
  QuestGoldButton,
  QuestOrnateFrame,
  QuestSectionTitle,
  QuestTypeTag,
} from '../../components/QuestUi';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { getBrowserLocalStartDate } from '../../application/onboardingRoadmap';
import { RecoveryQuest } from './RecoveryQuest';
import { TrainingQuest } from './TrainingQuest';
import { EquipmentProgramFlow } from '../equipment/EquipmentProgramFlow';
import { muscleLabel } from '../../presentation/trainingLabels';
import { RescheduleQuestSheet } from './RescheduleQuestSheet';

function BeginnerQuest() {
  const lessons = [
    ['胸トレとは', '大胸筋を鍛え、押す力とシルエットを育てる基礎パート。'],
    ['ベンチプレスの目的', '上半身の総合的な押す力を育てる、メインStrengthの中核種目。'],
    ['基本フォーム', '肩甲骨を寄せ、バーは胸の中央へ。足は床をしっかり踏む。'],
    ['注意点', '手首を反らせず、肩をすくめず、無理な高重量を避ける。'],
  ] as const;

  return (
    <QuestOrnateFrame className="beginner-quest" glow>
      <div className="beginner-quest-heading">
        <p>チュートリアルミッション</p>
        <h2>CHEST BEGINNER QUEST</h2>
      </div>
      <div className="beginner-quest-content">
        {lessons.map(([title, detail], index) => (
          <div className="beginner-lesson" key={title}>
            <span>{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </div>
        ))}
        <div className="beginner-example">
          <p>初回トレーニング</p>
          <span>軽めの負荷で、まずは動作を確かめよう。</span>
        </div>
      </div>
    </QuestOrnateFrame>
  );
}

function TrainingPlanPending() {
  return (
    <section className="quest-main-content" aria-labelledby="training-plan-pending-title">
      <QuestOrnateFrame className="main-quest-frame training-plan-pending" glow>
        <QuestSectionTitle>メインQUEST</QuestSectionTitle>
        <p className="training-plan-pending__eyebrow">TRAINING PLAN</p>
        <h2 id="training-plan-pending-title">トレーニングプランを準備中</h2>
        <p>
          このRoadmapのトレーニング内容は、利用可能な器具を確認してから作成します。
          固定のデモプランは表示・流用しません。
        </p>
      </QuestOrnateFrame>
    </section>
  );
}

export function CurrentQuest() {
  const {
    progressView,
    returnToMap,
    rescheduleCurrentQuest,
    trainingEvaluation,
    isTrainingPlanPending,
    clearCurrentQuest,
    validationMessage,
  } = useAdventureQuest();
  const [isBeginnerQuestVisible, setIsBeginnerQuestVisible] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleToday, setRescheduleToday] = useState('');
  const [rescheduleError, setRescheduleError] = useState(false);
  const currentNode = progressView.currentDailyNode;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  if (currentNode === null) {
    return (
      <section className="screen empty-quest-state">
        <p className="eyebrow">ROADMAP COMPLETE</p>
        <h1>Boss Anchorが利用可能です</h1>
        <button className="button button-secondary" type="button" onClick={returnToMap}>
          Mapへ戻る
        </button>
      </section>
    );
  }

  const currentQuestDate = currentNode.date;
  const isTraining = currentNode.type === 'training';
  if (isTraining && isTrainingPlanPending) {
    return <EquipmentProgramFlow />;
  }
  const sessionFocus = isTraining
    ? currentNode.sessionFocus.targetMuscles.map(muscleLabel).join(' · ')
    : null;
  const helperText = isTraining && !trainingEvaluation.readyToClear
    ? 'すべての必須種目を記録するとQUESTを達成できます'
    : '完了するとQUEST CLEAR後にAdventure Mapへ戻ります';
  const minimumRescheduleDate = rescheduleToday > currentQuestDate
    ? rescheduleToday
    : currentQuestDate;

  function openRescheduleSheet() {
    setRescheduleToday(getBrowserLocalStartDate());
    setRescheduleDate(currentQuestDate);
    setRescheduleError(false);
    setIsRescheduleOpen(true);
  }

  function confirmReschedule() {
    const result = rescheduleCurrentQuest(rescheduleDate, getBrowserLocalStartDate());
    if (result === 'invalid') {
      setRescheduleError(true);
      return;
    }
    setIsRescheduleOpen(false);
    setRescheduleError(false);
  }

  return (
    <section className="current-quest" aria-labelledby="quest-title">
      <header className="quest-header">
        <button className="back-button" type="button" onClick={returnToMap}>
          ← Mapへ戻る
        </button>
        <div className="quest-header-row">
          <div>
            <p className="quest-eyebrow">DAILY QUEST · {currentQuestDate}</p>
            <h1 id="quest-title">{isTraining ? 'トレーニングの日' : '休養の日'}</h1>
          </div>
          <QuestTypeTag>{isTraining ? 'Training' : 'Recovery'}</QuestTypeTag>
        </div>
      </header>

      <button className="quest-reschedule-button" type="button" onClick={openRescheduleSheet}>
        日程を変更
      </button>

      <section className="quest-info-panel" aria-label="本日のQuest案内">
        <p>
          現在のRoadmapに基づく本日の内容です。
          {sessionFocus !== null && <><br /><span className="quest-focus-label">対象部位 · {sessionFocus}</span></>}
        </p>
      </section>

      {!isTrainingPlanPending && (
        <button
          className={`beginner-toggle ${isBeginnerQuestVisible ? 'is-active' : ''}`}
          type="button"
          aria-pressed={isBeginnerQuestVisible}
          onClick={() => setIsBeginnerQuestVisible((visible) => !visible)}
        >
          📖 {isBeginnerQuestVisible ? 'BEGINNER QUEST 表示中' : 'BEGINNER QUEST を見る'}
        </button>
      )}

      {isBeginnerQuestVisible
        ? <BeginnerQuest />
        : isTraining ? <TrainingQuest /> : <RecoveryQuest />}

      <footer className="quest-footer">
        {validationMessage !== null && <p className="validation-message" role="alert">{validationMessage}</p>}
        <QuestGoldButton
          type="button"
          disabled={isTraining && !trainingEvaluation.readyToClear}
          onClick={clearCurrentQuest}
        >
          {isTraining ? '⚔ QUESTを完了する' : '☾ 休養を完了する'}
        </QuestGoldButton>
        <p className="quest-footer__help">{helperText}</p>
      </footer>

      {isRescheduleOpen && (
        <RescheduleQuestSheet
          currentDate={currentQuestDate}
          minimumDate={minimumRescheduleDate}
          selectedDate={rescheduleDate}
          hasError={rescheduleError}
          onDateChange={(date) => {
            setRescheduleDate(date);
            setRescheduleError(false);
          }}
          onConfirm={confirmReschedule}
          onCancel={() => setIsRescheduleOpen(false)}
        />
      )}
    </section>
  );
}
