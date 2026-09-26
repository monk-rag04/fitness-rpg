import { useEffect, useRef, useState } from 'react';
import { isFinalGoalCleared } from '@fitness-rpg/shared';
import { QuestGoldButton, QuestSectionTitle } from '../../components/QuestUi';
import { requestNextStageRoadmap } from '../../application/nextStageRoadmap';
import { exerciseLabel } from '../../presentation/trainingLabels';
import { useAdventureQuest } from '../../state/AdventureQuestContext';

function formatKg(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`;
}

export function StageClearScreen() {
  const {
    roadmap,
    stageNumber,
    bossBattle,
    mainStrengthGoalE1rmKg,
    stageTrainingProgramContext,
    nextStagePlanningStrength,
    startNextStage,
    navigateToHub,
  } = useAdventureQuest();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const winningAttempt = bossBattle?.winningAttempt;
  const finalGoalReached = winningAttempt !== undefined && mainStrengthGoalE1rmKg !== undefined &&
    isFinalGoalCleared(winningAttempt.estimatedE1rmKg, mainStrengthGoalE1rmKg);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function beginNextStage() {
    if (inFlight.current || winningAttempt === undefined || stageTrainingProgramContext === undefined ||
        mainStrengthGoalE1rmKg === undefined || nextStagePlanningStrength === null) return;
    inFlight.current = true;
    setError(null);
    setIsGenerating(true);
    const result = await requestNextStageRoadmap({
      currentE1rmKg: nextStagePlanningStrength,
      finalGoalE1rmKg: mainStrengthGoalE1rmKg,
      mainExerciseId: roadmap.mainExerciseId,
      trainingExperienceMonths: stageTrainingProgramContext.trainingExperienceMonths,
      trainingFrequencyPerWeek: stageTrainingProgramContext.trainingFrequencyPerWeek,
    });
    if (!mounted.current) return;
    inFlight.current = false;
    setIsGenerating(false);
    if (result.status === 'roadmap_created') {
      const status = startNextStage(result.roadmap);
      if (status !== 'started') setError('次のStageを開始できませんでした。状態を確認して、もう一度お試しください。');
      return;
    }
    if (result.status === 'stage_replanning_required') {
      setError('次のStageの日数を確定できませんでした。時間をおいて再度お試しください。');
    } else if (result.status === 'invalid_duration_estimate') {
      setError('Roadmapの見積もりを確認できませんでした。もう一度お試しください。');
    } else if (result.status === 'roadmap_request_failed') {
      setError('次のStageのRoadmapを作成できませんでした。通信を確認して再度お試しください。');
    } else {
      setError('次のStageを作成できませんでした。');
    }
  }

  if (bossBattle?.defeated !== true || winningAttempt === undefined) {
    return (
      <section className="screen stage-clear-screen" aria-labelledby="stage-clear-title">
        <p className="eyebrow">STAGE {stageNumber}</p>
        <h1 id="stage-clear-title">STAGE CLEAR</h1>
        <p role="status">Stage Clearの状態を確認できません。MAPへ戻ってください。</p>
        <QuestGoldButton type="button" onClick={() => navigateToHub('map')}>MAPへ戻る</QuestGoldButton>
      </section>
    );
  }

  return (
    <section className="screen stage-clear-screen" aria-labelledby="stage-clear-title">
      <header className="stage-clear-heading">
        <p className="eyebrow">BOSS DEFEATED</p>
        <h1 id="stage-clear-title">STAGE CLEAR</h1>
        <p>Stage {stageNumber}のBossを討伐しました。</p>
      </header>
      <section className="stage-clear-card" aria-label="Boss victory details">
        <QuestSectionTitle><span>BOSS CHALLENGE</span></QuestSectionTitle>
        <h2>{exerciseLabel(winningAttempt.exerciseId)}</h2>
        <dl>
          <div><dt>今回の挑戦</dt><dd>{formatKg(winningAttempt.weightKg)} × {winningAttempt.reps}回</dd></div>
          <div><dt>YOUR e1RM</dt><dd>{formatKg(winningAttempt.estimatedE1rmKg)}</dd></div>
          <div><dt>BOSS TARGET</dt><dd>{formatKg(bossBattle.targetE1rmKg)}</dd></div>
        </dl>
        {bossBattle.adapted && <p className="stage-clear-adapted">BOSS ADAPTED · Stage中の実績を反映</p>}
        {finalGoalReached && <p className="stage-clear-final-goal">FINAL GOAL CLEAR</p>}
      </section>

      {finalGoalReached ? (
        <div className="stage-clear-actions">
          <p className="stage-clear-copy">最終目標を達成しました。これまでの冒険を振り返れます。</p>
          <QuestGoldButton type="button" onClick={() => navigateToHub('progress')}>冒険を振り返る · PROGRESS</QuestGoldButton>
          <button className="boss-back-link" type="button" onClick={() => navigateToHub('map')}>MAPへ戻る</button>
        </div>
      ) : (
        <div className="stage-clear-actions">
          <p className="stage-clear-copy">次のRoadmapを作成し、新しいStageを始めましょう。</p>
          {error !== null && <p className="boss-message" role="alert">{error}</p>}
          <QuestGoldButton type="button" disabled={isGenerating} onClick={() => void beginNextStage()}>
            {isGenerating ? '次のStageを準備中…' : '次のStageへ'}
          </QuestGoldButton>
          <button className="stage-clear-secondary" type="button" onClick={() => navigateToHub('progress')}>冒険を振り返る · PROGRESS</button>
          <button className="boss-back-link" type="button" onClick={() => navigateToHub('map')}>MAPへ戻る</button>
        </div>
      )}
    </section>
  );
}
