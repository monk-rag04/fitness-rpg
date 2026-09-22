import {
  calculateSetE1rm,
  type ExerciseId,
} from '@fitness-rpg/shared';

export const ONBOARDING_MAIN_EXERCISES = [
  {
    id: 'barbell_bench_press',
    label: 'ベンチプレス',
    englishLabel: 'BENCH PRESS',
  },
  {
    id: 'barbell_back_squat',
    label: 'バックスクワット',
    englishLabel: 'BACK SQUAT',
  },
  {
    id: 'barbell_deadlift',
    label: 'デッドリフト',
    englishLabel: 'DEADLIFT',
  },
  {
    id: 'barbell_overhead_press',
    label: 'オーバーヘッドプレス',
    englishLabel: 'OVERHEAD PRESS',
  },
] as const satisfies readonly {
  readonly id: ExerciseId;
  readonly label: string;
  readonly englishLabel: string;
}[];

export type OnboardingMainExerciseId = (typeof ONBOARDING_MAIN_EXERCISES)[number]['id'];

export interface OnboardingDraftState {
  readonly bodyWeightKg: string;
  readonly trainingExperienceMonths: string;
  readonly trainingFrequencyPerWeek: string;
  readonly mainExerciseId: OnboardingMainExerciseId;
  readonly baselineWeightKg: string;
  readonly baselineReps: string;
  readonly isBaselineUnknown: boolean;
  readonly finalGoalE1rmKg: string;
}

export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingFieldError {
  readonly field: keyof OnboardingDraftState;
  readonly message: string;
}

export type BaselinePreview =
  | { readonly status: 'missing' }
  | { readonly status: 'incomplete' }
  | { readonly status: 'invalid_weight' }
  | { readonly status: 'invalid_reps' }
  | { readonly status: 'ready'; readonly e1rmKg: number; readonly ruleVersion: string };

export function createInitialOnboardingDraft(): OnboardingDraftState {
  return {
    bodyWeightKg: '',
    trainingExperienceMonths: '',
    trainingFrequencyPerWeek: '3',
    mainExerciseId: 'barbell_bench_press',
    baselineWeightKg: '',
    baselineReps: '',
    isBaselineUnknown: false,
    finalGoalE1rmKg: '',
  };
}

function asFiniteNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNonnegativeInteger(value: string): number | null {
  const parsed = asFiniteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function asFrequency(value: string): number | null {
  const parsed = asNonnegativeInteger(value);
  return parsed !== null && parsed >= 1 && parsed <= 7 ? parsed : null;
}

/**
 * The UI never implements Epley itself. It asks the shared D-023 Domain for a
 * preview using the same accepted rule that validates the final onboarding input.
 */
export function getBaselinePreview(draft: OnboardingDraftState): BaselinePreview {
  if (draft.isBaselineUnknown) return { status: 'missing' };

  const weightKg = asFiniteNumber(draft.baselineWeightKg);
  const reps = asFiniteNumber(draft.baselineReps);
  if (weightKg === null && reps === null) return { status: 'missing' };
  if (weightKg === null || reps === null) return { status: 'incomplete' };
  if (weightKg <= 0) return { status: 'invalid_weight' };
  if (!Number.isSafeInteger(reps) || reps < 1 || reps > 10) return { status: 'invalid_reps' };

  try {
    const result = calculateSetE1rm({ weightKg, reps });
    return result.eligible
      ? { status: 'ready', e1rmKg: result.estimated1rmKg, ruleVersion: result.ruleVersion }
      : { status: 'invalid_reps' };
  } catch {
    return { status: 'invalid_weight' };
  }
}

/** Usability validation by step; shared Domain remains the authoritative submit validation. */
export function getOnboardingStepErrors(
  step: OnboardingStep,
  draft: OnboardingDraftState,
): readonly OnboardingFieldError[] {
  if (step === 1) {
    const errors: OnboardingFieldError[] = [];
    const weight = asFiniteNumber(draft.bodyWeightKg);
    if (weight === null || weight <= 0) {
      errors.push({ field: 'bodyWeightKg', message: '体重は0より大きい数値を入力してください。' });
    }
    if (asNonnegativeInteger(draft.trainingExperienceMonths) === null) {
      errors.push({ field: 'trainingExperienceMonths', message: 'トレーニング歴は0以上の月数で入力してください。' });
    }
    if (asFrequency(draft.trainingFrequencyPerWeek) === null) {
      errors.push({ field: 'trainingFrequencyPerWeek', message: '週の頻度は1〜7日で入力してください。' });
    }
    return errors;
  }

  if (step === 2) {
    const preview = getBaselinePreview(draft);
    if (preview.status === 'missing') return [];
    if (preview.status === 'incomplete') {
      return [{ field: 'baselineWeightKg', message: '重量とrepsは両方入力してください。' }];
    }
    if (preview.status === 'invalid_weight') {
      return [{ field: 'baselineWeightKg', message: '重量は0より大きい数値を入力してください。' }];
    }
    if (preview.status === 'invalid_reps') {
      return [{ field: 'baselineReps', message: 'repsは1〜10回の整数で入力してください。' }];
    }
    return [];
  }

  const goal = asFiniteNumber(draft.finalGoalE1rmKg);
  if (goal === null || goal <= 0) {
    return [{ field: 'finalGoalE1rmKg', message: 'Final Goal e1RMを入力してください。' }];
  }
  const baseline = getBaselinePreview(draft);
  if (baseline.status === 'ready' && goal <= baseline.e1rmKg) {
    return [{ field: 'finalGoalE1rmKg', message: 'Final Goalは現在のBaseline e1RMより大きい値にしてください。' }];
  }
  return [];
}

export function toOnboardingRoadmapDraft(draft: OnboardingDraftState): Record<string, unknown> {
  const baseline = getBaselinePreview(draft);
  return {
    bodyWeightKg: Number(draft.bodyWeightKg),
    trainingExperienceMonths: Number(draft.trainingExperienceMonths),
    trainingFrequencyPerWeek: Number(draft.trainingFrequencyPerWeek),
    mainExerciseId: draft.mainExerciseId,
    baselineWeightKg: baseline.status === 'missing' ? null : Number(draft.baselineWeightKg),
    baselineReps: baseline.status === 'missing' ? null : Number(draft.baselineReps),
    finalGoalE1rmKg: Number(draft.finalGoalE1rmKg),
  };
}

export function formatE1rmKg(value: number): string {
  return `${value.toFixed(1)}kg`;
}

/** Keeps a repeated tap from issuing a second duration request while one is pending. */
export function createOnboardingSubmissionGate() {
  let isInFlight = false;

  return {
    async run<T>(operation: () => Promise<T>): Promise<T | null> {
      if (isInFlight) return null;
      isInFlight = true;
      try {
        return await operation();
      } finally {
        isInFlight = false;
      }
    },
  };
}
