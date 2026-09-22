import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { OnboardingRoadmapApplicationResult } from '../../application/onboardingRoadmap';
import { startOnboardingRoadmap } from '../../application/onboardingRoadmap';
import { QuestGoldButton, QuestOrnateFrame, QuestSectionTitle } from '../../components/QuestUi';
import {
  ONBOARDING_MAIN_EXERCISES,
  createOnboardingSubmissionGate,
  createInitialOnboardingDraft,
  formatE1rmKg,
  getBaselinePreview,
  getOnboardingStepErrors,
  toOnboardingRoadmapDraft,
  type OnboardingDraftState,
  type OnboardingStep,
} from './onboardingState';

type RoadmapCreated = Extract<OnboardingRoadmapApplicationResult, { readonly status: 'roadmap_created' }>;

interface OnboardingProps {
  readonly onRoadmapCreated: (result: RoadmapCreated) => void;
}

function errorCopy(result: Exclude<OnboardingRoadmapApplicationResult, RoadmapCreated>): string {
  switch (result.status) {
    case 'baseline_required':
      return 'Roadmapを作成するには、現在実施できる重量とrepsによるStrength Assessmentが必要です。';
    case 'stage_replanning_required':
      return '現在の計画期間では、このStageのRoadmapを確定できません。設定を見直してください。';
    case 'invalid_duration_estimate':
      return 'Roadmap期間の見積もりを確認できませんでした。もう一度お試しください。';
    case 'duration_request_failed':
      return result.code === 'network_error'
        ? '通信に失敗しました。接続を確認して再試行してください。'
        : result.code === 'provider_failure'
          ? 'Roadmap見積もりを一時的に取得できませんでした。時間をおいて再試行してください。'
          : result.code === 'invalid_structured_output'
            ? 'Roadmap見積もりの形式を確認できませんでした。もう一度お試しください。'
            : 'Roadmapを作成できませんでした。入力を確認して再試行してください。';
    case 'invalid_input':
      return '入力を確認してください。';
  }
}

function stepForInvalidInput(result: Extract<OnboardingRoadmapApplicationResult, { readonly status: 'invalid_input' }>): OnboardingStep {
  const path = result.errors[0]?.path ?? '';
  if (path.includes('bodyWeight') || path.includes('Experience') || path.includes('Frequency')) return 1;
  if (path.includes('baseline') || path.includes('mainExercise')) return 2;
  return 3;
}

function StepIndicator({ currentStep }: { readonly currentStep: OnboardingStep }) {
  return (
    <ol className="onboarding-stepper" aria-label={`Onboarding Step ${currentStep} / 3`}>
      {(['CHARACTER', 'MAIN STRENGTH', 'FINAL BOSS'] as const).map((label, index) => {
        const step = (index + 1) as OnboardingStep;
        return (
          <li className={step === currentStep ? 'is-current' : step < currentStep ? 'is-complete' : ''} key={label}>
            <span aria-hidden="true">{step}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}

function FieldError({ message }: { readonly message: string | null }) {
  return message === null ? null : <p className="onboarding-field-error" role="alert">{message}</p>;
}

export function Onboarding({ onRoadmapCreated }: OnboardingProps) {
  const [draft, setDraft] = useState<OnboardingDraftState>(createInitialOnboardingDraft);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRoadmap, setCreatedRoadmap] = useState<RoadmapCreated | null>(null);
  const submissionGate = useRef(createOnboardingSubmissionGate());
  const baseline = useMemo(() => getBaselinePreview(draft), [draft]);

  function updateText(field: Exclude<keyof OnboardingDraftState, 'mainExerciseId' | 'isBaselineUnknown'>) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraft((current) => ({ ...current, [field]: value }));
      setFieldMessage(null);
      setRequestMessage(null);
    };
  }

  function goToNextStep() {
    const errors = getOnboardingStepErrors(currentStep, draft);
    if (errors.length > 0) {
      setFieldMessage(errors[0].message);
      return;
    }
    setFieldMessage(null);
    setRequestMessage(null);
    setCurrentStep((current) => (current + 1) as OnboardingStep);
  }

  function goToPreviousStep() {
    setFieldMessage(null);
    setRequestMessage(null);
    setCurrentStep((current) => (current - 1) as OnboardingStep);
  }

  async function submitRoadmap() {
    if (isSubmitting) return;

    const stepErrors = ([1, 2, 3] as const).flatMap((step) => getOnboardingStepErrors(step, draft));
    if (stepErrors.length > 0) {
      setFieldMessage(stepErrors[0].message);
      return;
    }

    setFieldMessage(null);
    setRequestMessage(null);
    const result = await submissionGate.current.run(async () => {
      setIsSubmitting(true);
      try {
        return await startOnboardingRoadmap(toOnboardingRoadmapDraft(draft));
      } finally {
        setIsSubmitting(false);
      }
    });
    if (result === null) return;

    if (result.status === 'roadmap_created') {
      setCreatedRoadmap(result);
      return;
    }
    if (result.status === 'invalid_input') {
      setCurrentStep(stepForInvalidInput(result));
    }
    if (result.status === 'baseline_required') {
      setCurrentStep(2);
    }
    setRequestMessage(errorCopy(result));
  }

  if (createdRoadmap !== null) {
    return (
      <section className="onboarding-screen onboarding-screen--success" aria-labelledby="onboarding-success-title">
        <div className="onboarding-brand" aria-hidden="true"><span>⚔</span></div>
        <p className="onboarding-kicker">ROADMAP READY</p>
        <h1 id="onboarding-success-title">最初のStageを準備しました</h1>
        <p className="onboarding-lead">あなたの記録をもとに、最初のBossへ向かうRoadmapを作成しました。</p>
        <QuestOrnateFrame className="onboarding-success-card" glow>
          <dl>
            <div><dt>AI ESTIMATED DAYS</dt><dd>{createdRoadmap.estimatedAchievementDays}日</dd></div>
            <div><dt>SELECTED ROADMAP</dt><dd>{createdRoadmap.selectedRoadmapDurationDays}日</dd></div>
            <div><dt>STAGE TARGET</dt><dd>{formatE1rmKg(createdRoadmap.stage.stageTargetE1rmKg)}</dd></div>
          </dl>
        </QuestOrnateFrame>
        <QuestGoldButton type="button" onClick={() => onRoadmapCreated(createdRoadmap)}>
          Adventure Mapへ向かう
        </QuestGoldButton>
      </section>
    );
  }

  return (
    <section className="onboarding-screen" aria-labelledby="onboarding-title">
      <header className="onboarding-intro">
        <div className="onboarding-brand" aria-hidden="true"><span>⚔</span></div>
        <p className="onboarding-wordmark">IRONQUEST</p>
        <h1 id="onboarding-title">現実で鍛え、Bossを討て。</h1>
        <p>あなた自身が主人公のRPG。最初のStrength Roadmapを準備します。</p>
      </header>

      <StepIndicator currentStep={currentStep} />

      <fieldset className="onboarding-content" disabled={isSubmitting}>
        {currentStep === 1 && (
          <QuestOrnateFrame className="onboarding-panel" glow>
            <QuestSectionTitle>CHARACTER 情報</QuestSectionTitle>
            <div className="onboarding-form-grid">
              <label>
                <span>現在の体重 <em>kg</em></span>
                <input type="number" inputMode="decimal" min="0" step="any" value={draft.bodyWeightKg} onChange={updateText('bodyWeightKg')} placeholder="例：72" />
              </label>
              <label>
                <span>トレーニング歴 <em>months</em></span>
                <input type="number" inputMode="numeric" min="0" step="1" value={draft.trainingExperienceMonths} onChange={updateText('trainingExperienceMonths')} placeholder="例：8" />
                <small>カテゴリではなく、経験月数を直接入力します。</small>
              </label>
              <label>
                <span>週のトレーニング頻度 <em>days / week</em></span>
                <input type="number" inputMode="numeric" min="1" max="7" step="1" value={draft.trainingFrequencyPerWeek} onChange={updateText('trainingFrequencyPerWeek')} />
                <small>1〜7日の範囲で設定します。</small>
              </label>
            </div>
          </QuestOrnateFrame>
        )}

        {currentStep === 2 && (
          <QuestOrnateFrame className="onboarding-panel" glow>
            <QuestSectionTitle>MAIN STRENGTH</QuestSectionTitle>
            <p className="onboarding-panel-intro">Bossへ挑むメインStrength種目を選び、最近実施できたSetを記録してください。</p>
            <div className="onboarding-exercise-grid" role="radiogroup" aria-label="Main Strength種目">
              {ONBOARDING_MAIN_EXERCISES.map((exercise) => (
                <button
                  className={draft.mainExerciseId === exercise.id ? 'is-selected' : ''}
                  key={exercise.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.mainExerciseId === exercise.id}
                  onClick={() => {
                    setDraft((current) => ({ ...current, mainExerciseId: exercise.id }));
                    setFieldMessage(null);
                    setRequestMessage(null);
                  }}
                >
                  <span>{exercise.label}</span><small>{exercise.englishLabel}</small>
                </button>
              ))}
              <button className="is-disabled" type="button" disabled aria-label="Pull-up, Coming later">
                <span>プルアップ</span><small>PULL-UP · Coming later</small>
              </button>
            </div>

            <label className="onboarding-baseline-toggle">
              <input
                type="checkbox"
                checked={draft.isBaselineUnknown}
                onChange={(event) => {
                  const isBaselineUnknown = event.target.checked;
                  setDraft((current) => ({ ...current, isBaselineUnknown }));
                  setFieldMessage(null);
                  setRequestMessage(null);
                }}
              />
              <span>まだ実施できる重量がわからない</span>
            </label>

            {draft.isBaselineUnknown ? (
              <div className="onboarding-baseline-missing" role="status">
                <strong>STRENGTH ASSESSMENT REQUIRED</strong>
                <p>Roadmapを作成するには、現在のStrengthの基準が必要です。初心者向けのAssessmentは将来対応です。</p>
              </div>
            ) : (
              <div className="onboarding-baseline-inputs">
                <label>
                  <span>最近の重量 <em>kg</em></span>
                  <input type="number" inputMode="decimal" min="0" step="any" value={draft.baselineWeightKg} onChange={updateText('baselineWeightKg')} placeholder="例：60" />
                </label>
                <label>
                  <span>reps <em>1–10</em></span>
                  <input type="number" inputMode="numeric" min="1" max="10" step="1" value={draft.baselineReps} onChange={updateText('baselineReps')} placeholder="例：5" />
                </label>
              </div>
            )}

            <div className={`onboarding-baseline-result is-${baseline.status}`} aria-live="polite">
              <div><p>CURRENT STRENGTH</p><span>推定1RM / Production Domain</span></div>
              <strong>{baseline.status === 'ready' ? formatE1rmKg(baseline.e1rmKg) : '—'}</strong>
            </div>
          </QuestOrnateFrame>
        )}

        {currentStep === 3 && (
          <QuestOrnateFrame className="onboarding-panel onboarding-panel--goal" glow>
            <QuestSectionTitle>FINAL BOSS GOAL</QuestSectionTitle>
            <p className="onboarding-panel-intro">最終Goal e1RMを直接入力してください。推奨値は表示しません。</p>
            <div className="onboarding-goal-summary">
              <div><span>CURRENT BASELINE</span><strong>{baseline.status === 'ready' ? formatE1rmKg(baseline.e1rmKg) : '必要です'}</strong></div>
              <div><span>FINAL GOAL</span><strong>{draft.finalGoalE1rmKg.trim() === '' ? '—' : `${draft.finalGoalE1rmKg}kg`}</strong></div>
            </div>
            <label className="onboarding-goal-input">
              <span>Final Goal e1RM <em>kg</em></span>
              <input type="number" inputMode="decimal" min="0" step="any" value={draft.finalGoalE1rmKg} onChange={updateText('finalGoalE1rmKg')} placeholder="例：80" />
            </label>
            {fieldMessage !== null && <FieldError message={fieldMessage} />}
            <div className="onboarding-estimate-area" aria-live="polite">
              <p>AI ROADMAP ESTIMATE</p>
              {isSubmitting
                ? <strong>Roadmapを準備中…</strong>
                : <span>Stage TargetとRoadmap期間は、入力を検証してから確定します。</span>}
            </div>
          </QuestOrnateFrame>
        )}
      </fieldset>

      {currentStep !== 3 && fieldMessage !== null && <FieldError message={fieldMessage} />}
      {requestMessage !== null && <p className="onboarding-request-error" role="alert">{requestMessage}</p>}

      <footer className="onboarding-actions">
        {currentStep > 1 && (
          <button type="button" className="onboarding-back-button" disabled={isSubmitting} onClick={goToPreviousStep}>戻る</button>
        )}
        {currentStep < 3 ? (
          <QuestGoldButton type="button" disabled={isSubmitting} onClick={goToNextStep}>次へ</QuestGoldButton>
        ) : (
          <QuestGoldButton type="button" disabled={isSubmitting} onClick={submitRoadmap}>
            {isSubmitting ? 'Roadmapを準備中…' : 'この設定でRoadmapを作成'}
          </QuestGoldButton>
        )}
      </footer>
    </section>
  );
}
