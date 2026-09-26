import {
  completeRecoveryQuest,
  completeTrainingQuest,
  createInitialStageProgress,
  deriveStageProgressView,
  evaluateTrainingQuestCompletion,
  rescheduleCurrentQuest as rescheduleRoadmapCurrentQuest,
  validateExerciseWorkoutResult,
  getBestClearedMainE1rmKg,
  unlockBossBattle,
  resolveNextStagePlanningStrength,
  CurrentQuestRescheduleError,
  type BossBattleState,
  type BossChallengeResult,
  type EquipmentId,
  type ExerciseId,
  type GymEquipmentProfile,
  type ExerciseWorkoutResult,
  type ExerciseSkipReason,
  type ExerciseSkipRecord,
  type QuestCompletionResult,
  type QuestRewardSummary,
  type StageRoadmap,
  type StageProgress,
  type ValidatedStageTrainingProgram,
  type TrainingQuestCompletionEvaluation,
  type ValidatedTrainingPlan,
  type WorkoutResultValidationResult,
} from '@fitness-rpg/shared';
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { DEMO_EQUIPMENT_PROFILE, DEMO_STAGE_ROADMAP, DEMO_TRAINING_PLAN } from '../demo/fixture';
import {
  type AdventureQuestSession,
  completeAdventureQuest,
  challengeAdventureBoss,
  createAdventureQuestDomainState,
  cacheStageTrainingProgram as cacheStageTrainingProgramForRoadmap,
  cacheTrainingPlanForDay as cacheTrainingPlanForRoadmapDay,
  getTrainingPlanForDay,
  saveWorkoutResultForCurrentDay,
  setStageEquipmentProfile as setStageEquipmentProfileForSession,
  setExerciseLoadStepForCurrentDay as setExerciseLoadStepForSession,
  skipExerciseForCurrentDay as skipExerciseForSession,
  advanceAdventureToNextStage,
  undoExerciseSkipForCurrentDay as undoExerciseSkipForSession,
  registerExerciseBaselineForCurrentDay as registerExerciseBaselineForSession,
  type AdventureQuestDomainState,
  type CompletedStageSummary,
  type ExerciseBaselineRegistrationStatus,
  type ExerciseLoadStepSessionStatus,
  type ExerciseSkipSessionStatus,
  type StageEquipmentProfileStatus,
  type StageTrainingProgramSessionContext,
  type StageTrainingProgramCacheStatus,
  type TrainingPlanCacheStatus,
  type NextStageTransitionStatus,
} from './adventureSession';

export { type AdventureQuestSession, createOnboardingAdventureSession } from './adventureSession';

export type AdventureHubScreen = 'map' | 'character' | 'progress';
export type AppScreen = AdventureHubScreen | 'quest' | 'boss' | 'stage-clear';
export type CurrentQuestRescheduleStatus = 'rescheduled' | 'unchanged' | 'invalid';

interface EphemeralUiState {
  readonly screen: AppScreen;
  readonly isClearFeedbackVisible: boolean;
  readonly questRewardSummary: QuestRewardSummary | null;
  readonly validationMessage: string | null;
  readonly baselineSetupConfirmedById: Readonly<Record<string, true>>;
}

interface AdventureQuestState {
  readonly domain: AdventureQuestDomainState;
  readonly ui: EphemeralUiState;
}

type Action =
  | { readonly type: 'openCurrentQuest' }
  | { readonly type: 'returnToMap' }
  | { readonly type: 'navigateToHub'; readonly screen: AdventureHubScreen }
  | { readonly type: 'openBossBattle'; readonly bossBattle: BossBattleState }
  | { readonly type: 'openStageClear' }
  | { readonly type: 'bossVictory'; readonly bossBattle: BossBattleState }
  | { readonly type: 'startNextStage'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'cacheTrainingPlanForDay'; readonly dayIndex: number; readonly plan: ValidatedTrainingPlan }
  | { readonly type: 'cacheStageTrainingProgram'; readonly program: ValidatedStageTrainingProgram }
  | { readonly type: 'setStageEquipmentProfile'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'registerExerciseBaseline'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'setExerciseLoadStep'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'confirmExerciseBaselineSetup'; readonly exerciseId: ExerciseId }
  | { readonly type: 'rescheduleCurrentQuest'; readonly roadmap: StageRoadmap }
  | { readonly type: 'saveWorkoutResult'; readonly result: ExerciseWorkoutResult }
  | { readonly type: 'skipExercise'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'undoExerciseSkip'; readonly domain: AdventureQuestDomainState }
  | { readonly type: 'completeQuest'; readonly dayIndex: number }
  | { readonly type: 'showValidationMessage'; readonly message: string }
  | { readonly type: 'continueAdventure' };

export const DEMO_ADVENTURE_SESSION: AdventureQuestSession = {
  source: 'demo',
  roadmap: DEMO_STAGE_ROADMAP,
  initialProgress: createInitialStageProgress(DEMO_STAGE_ROADMAP),
  planByDay: { 0: DEMO_TRAINING_PLAN },
  equipmentProfile: DEMO_EQUIPMENT_PROFILE,
};

function createInitialState(session: AdventureQuestSession): AdventureQuestState {
  return {
    domain: createAdventureQuestDomainState(session),
    ui: {
      screen: 'map',
      isClearFeedbackVisible: false,
      questRewardSummary: null,
      validationMessage: null,
      baselineSetupConfirmedById: {},
    },
  };
}

function reducer(state: AdventureQuestState, action: Action): AdventureQuestState {
  switch (action.type) {
    case 'openCurrentQuest':
      return {
        ...state,
        ui: { ...state.ui, screen: 'quest', validationMessage: null },
      };
    case 'returnToMap':
      return {
        ...state,
        ui: { ...state.ui, screen: 'map', validationMessage: null },
      };
    case 'navigateToHub':
      return {
        ...state,
        ui: { ...state.ui, screen: action.screen, validationMessage: null },
      };
    case 'openBossBattle':
      return {
        ...state,
        domain: { ...state.domain, bossBattle: action.bossBattle },
        ui: { ...state.ui, screen: 'boss', validationMessage: null },
      };
    case 'openStageClear':
      return { ...state, ui: { ...state.ui, screen: 'stage-clear', validationMessage: null } };
    case 'bossVictory':
      return {
        ...state,
        domain: { ...state.domain, bossBattle: action.bossBattle },
        ui: { ...state.ui, screen: 'stage-clear', validationMessage: null },
      };
    case 'startNextStage':
      return {
        domain: action.domain,
        ui: {
          ...state.ui,
          screen: 'map',
          isClearFeedbackVisible: false,
          questRewardSummary: null,
          validationMessage: null,
          baselineSetupConfirmedById: {},
        },
      };
    case 'cacheTrainingPlanForDay': {
      const cacheResult = cacheTrainingPlanForRoadmapDay(
        state.domain.roadmap,
        state.domain.planByDay,
        action.dayIndex,
        action.plan,
      );
      if (cacheResult.status !== 'cached') return state;
      return {
        ...state,
        domain: { ...state.domain, planByDay: cacheResult.planByDay },
      };
    }
    case 'cacheStageTrainingProgram': {
      const cacheResult = cacheStageTrainingProgramForRoadmap(state.domain, action.program);
      if (cacheResult.status !== 'cached') return state;
      return {
        ...state,
        domain: { ...state.domain, planByDay: cacheResult.planByDay },
      };
    }
    case 'setStageEquipmentProfile':
      return {
        ...state,
        domain: action.domain,
      };
    case 'registerExerciseBaseline':
      return { ...state, domain: action.domain };
    case 'setExerciseLoadStep':
      return { ...state, domain: action.domain };
    case 'confirmExerciseBaselineSetup':
      return {
        ...state,
        ui: {
          ...state.ui,
          baselineSetupConfirmedById: {
            ...state.ui.baselineSetupConfirmedById,
            [action.exerciseId]: true,
          },
        },
      };
    case 'rescheduleCurrentQuest':
      return {
        ...state,
        domain: { ...state.domain, roadmap: action.roadmap },
      };
    case 'saveWorkoutResult': {
      return {
        ...state,
        domain: saveWorkoutResultForCurrentDay(state.domain, action.result),
        ui: { ...state.ui, validationMessage: null },
      };
    }
    case 'skipExercise':
    case 'undoExerciseSkip':
      return { ...state, domain: action.domain };
    case 'completeQuest': {
      const transition = completeAdventureQuest(state.domain, action.dayIndex);
      if (transition.status !== 'completed') {
        if (transition.status === 'invalid_reward_state' ||
            transition.status === 'invalid_exercise_progress_state') {
          return {
            ...state,
            ui: { ...state.ui, validationMessage: 'Questの結果を確定できませんでした。状態を確認してください。' },
          };
        }
        return state;
      }
      return {
        ...state,
        domain: transition.domain,
        ui: {
          ...state.ui,
          isClearFeedbackVisible: true,
          questRewardSummary: transition.rewardSummary,
          validationMessage: null,
        },
      };
    }
    case 'showValidationMessage':
      return {
        ...state,
        ui: { ...state.ui, validationMessage: action.message },
      };
    case 'continueAdventure':
      return {
        ...state,
        ui: {
          ...state.ui,
          screen: 'map',
          isClearFeedbackVisible: false,
          questRewardSummary: null,
          validationMessage: null,
        },
      };
  }
}

interface AdventureQuestContextValue {
  readonly screen: AppScreen;
  readonly roadmap: StageRoadmap;
  readonly progress: StageProgress;
  readonly progressView: ReturnType<typeof deriveStageProgressView>;
  readonly trainingPlan: ValidatedTrainingPlan | null;
  readonly isTrainingPlanPending: boolean;
  readonly equipmentProfile: GymEquipmentProfile | undefined;
  readonly stageTrainingProgramContext: StageTrainingProgramSessionContext | undefined;
  readonly exerciseProgressById: AdventureQuestDomainState['exerciseProgressById'];
  readonly baselineSetupConfirmedById: Readonly<Record<string, true>>;
  readonly workoutResults: readonly ExerciseWorkoutResult[];
  readonly exerciseSkips: readonly ExerciseSkipRecord[];
  readonly trainingEvaluation: TrainingQuestCompletionEvaluation;
  readonly isClearFeedbackVisible: boolean;
  readonly questRewardSummary: QuestRewardSummary | null;
  readonly characterGrowth: AdventureQuestDomainState['characterGrowth'];
  readonly workoutResultsByDay: AdventureQuestDomainState['workoutResultsByDay'];
  readonly mainStrengthGoalE1rmKg: number | undefined;
  readonly stageNumber: number;
  readonly bossBattle: BossBattleState | undefined;
  readonly completedStages: readonly CompletedStageSummary[];
  readonly nextStagePlanningStrength: number | null;
  readonly validationMessage: string | null;
  openCurrentQuest: () => void;
  returnToMap: () => void;
  cacheTrainingPlanForDay: (dayIndex: number, plan: ValidatedTrainingPlan) => TrainingPlanCacheStatus;
  cacheStageTrainingProgram: (program: ValidatedStageTrainingProgram) => StageTrainingProgramCacheStatus;
  setStageEquipmentProfile: (equipmentIds: readonly EquipmentId[]) => StageEquipmentProfileStatus;
  registerExerciseBaseline: (input: { readonly exerciseId: string; readonly weightKg: unknown; readonly reps: unknown }) => ExerciseBaselineRegistrationStatus;
  setExerciseLoadStep: (plannedExerciseId: string, loadStepKg: unknown) => ExerciseLoadStepSessionStatus;
  skipExercise: (input: { readonly exerciseId: string; readonly reason: ExerciseSkipReason; readonly pledgeAccepted: boolean }) => ExerciseSkipSessionStatus;
  undoExerciseSkip: (exerciseId: string) => ExerciseSkipSessionStatus;
  confirmExerciseBaselineSetup: (exerciseId: ExerciseId) => void;
  rescheduleCurrentQuest: (newDate: string, today: string) => CurrentQuestRescheduleStatus;
  saveWorkoutResult: (input: unknown) => WorkoutResultValidationResult;
  clearCurrentQuest: () => QuestCompletionResult | null;
  continueAdventure: () => void;
  navigateToHub: (screen: AdventureHubScreen) => void;
  openBossBattle: () => boolean;
  openStageClear: () => boolean;
  challengeBoss: (input: { readonly weightKg: unknown; readonly reps: unknown }) => BossChallengeResult;
  startNextStage: (roadmap: StageRoadmap) => NextStageTransitionStatus;
}

const AdventureQuestContext = createContext<AdventureQuestContextValue | null>(null);

function getCurrentWorkoutResults(
  state: AdventureQuestState,
): readonly ExerciseWorkoutResult[] {
  return Object.values(
    state.domain.workoutResultsByDay[state.domain.progress.currentDayIndex] ?? {},
  );
}

export function AdventureQuestProvider({
  children,
  session = DEMO_ADVENTURE_SESSION,
}: {
  readonly children: ReactNode;
  readonly session?: AdventureQuestSession;
}) {
  const [state, dispatch] = useReducer(reducer, session, createInitialState);
  const workoutResults = getCurrentWorkoutResults(state);
  const exerciseSkips = Object.values(
    state.domain.exerciseSkipsByDay[state.domain.progress.currentDayIndex] ?? {},
  );
  const progressView = deriveStageProgressView(state.domain.roadmap, state.domain.progress);
  const trainingPlan = getTrainingPlanForDay(
    state.domain.roadmap,
    state.domain.planByDay,
    state.domain.progress.currentDayIndex,
  );
  const isTrainingPlanPending = progressView.currentDailyNode?.type === 'training' && trainingPlan === null;
  const trainingEvaluation = evaluateTrainingQuestCompletion(
    trainingPlan ?? undefined,
    workoutResults,
    state.domain.equipmentProfile ?? undefined,
    exerciseSkips,
  );
  const bossBattle = state.domain.bossBattle;
  const bestActualMainE1rmKg = getBestClearedMainE1rmKg(
    state.domain.roadmap,
    state.domain.progress,
    state.domain.workoutResultsByDay,
  );
  const nextStagePlanningStrength = bossBattle?.winningAttempt === undefined
    ? null
    : resolveNextStagePlanningStrength(bestActualMainE1rmKg, bossBattle.winningAttempt.estimatedE1rmKg);

  const value = useMemo<AdventureQuestContextValue>(() => ({
    screen: state.ui.screen,
    roadmap: state.domain.roadmap,
    progress: state.domain.progress,
    progressView,
    trainingPlan,
    isTrainingPlanPending,
    equipmentProfile: state.domain.equipmentProfile,
    stageTrainingProgramContext: state.domain.stageTrainingProgramContext,
    exerciseProgressById: state.domain.exerciseProgressById,
    baselineSetupConfirmedById: state.ui.baselineSetupConfirmedById,
    workoutResults,
    exerciseSkips,
    trainingEvaluation,
    isClearFeedbackVisible: state.ui.isClearFeedbackVisible,
    questRewardSummary: state.ui.questRewardSummary,
    characterGrowth: state.domain.characterGrowth,
    workoutResultsByDay: state.domain.workoutResultsByDay,
    mainStrengthGoalE1rmKg: state.domain.mainStrengthGoalE1rmKg,
    stageNumber: state.domain.stageNumber,
    bossBattle,
    completedStages: state.domain.completedStages,
    nextStagePlanningStrength,
    validationMessage: state.ui.validationMessage,
    openCurrentQuest: () => {
      if (progressView.currentDailyNode !== null) {
        dispatch({ type: 'openCurrentQuest' });
      }
    },
    returnToMap: () => dispatch({ type: 'returnToMap' }),
    openBossBattle: () => {
      if (!progressView.bossAvailable || bossBattle?.defeated === true) return false;
      const finalGoalE1rmKg = state.domain.mainStrengthGoalE1rmKg ?? state.domain.roadmap.stageTargetE1rmKg;
      const unlock = unlockBossBattle({
        roadmap: state.domain.roadmap,
        progress: state.domain.progress,
        finalGoalE1rmKg,
        bestActualMainE1rmKg,
        existingBossBattle: bossBattle,
      });
      if (unlock.status !== 'unlocked' && unlock.status !== 'already_unlocked') return false;
      dispatch({ type: 'openBossBattle', bossBattle: unlock.bossBattle });
      return true;
    },
    openStageClear: () => {
      if (bossBattle?.defeated !== true) return false;
      dispatch({ type: 'openStageClear' });
      return true;
    },
    challengeBoss: ({ weightKg, reps }) => {
      const transition = challengeAdventureBoss(state.domain, { weightKg, reps });
      if (transition.result.status === 'victory') {
        dispatch({ type: 'bossVictory', bossBattle: transition.result.bossBattle });
      }
      const result = transition.result;
      return result;
    },
    startNextStage: (roadmap) => {
      const transition = advanceAdventureToNextStage(state.domain, roadmap);
      if (transition.status === 'started') dispatch({ type: 'startNextStage', domain: transition.domain });
      return transition.status;
    },
    cacheTrainingPlanForDay: (dayIndex, plan) => {
      const cacheResult = cacheTrainingPlanForRoadmapDay(
        state.domain.roadmap,
        state.domain.planByDay,
        dayIndex,
        plan,
      );
      if (cacheResult.status === 'cached') {
        dispatch({ type: 'cacheTrainingPlanForDay', dayIndex, plan });
      }
      return cacheResult.status;
    },
    cacheStageTrainingProgram: (program) => {
      const cacheResult = cacheStageTrainingProgramForRoadmap(state.domain, program);
      if (cacheResult.status === 'cached') {
        dispatch({ type: 'cacheStageTrainingProgram', program });
      }
      return cacheResult.status;
    },
    setStageEquipmentProfile: (equipmentIds) => {
      const profileResult = setStageEquipmentProfileForSession(state.domain, equipmentIds);
      if (profileResult.status === 'set') {
        dispatch({ type: 'setStageEquipmentProfile', domain: profileResult.target });
      }
      return profileResult.status;
    },
    registerExerciseBaseline: (input) => {
      const transition = registerExerciseBaselineForSession(state.domain, input);
      if (transition.status === 'registered') {
        dispatch({ type: 'registerExerciseBaseline', domain: transition.domain });
      }
      return transition.status;
    },
    setExerciseLoadStep: (plannedExerciseId, loadStepKg) => {
      const transition = setExerciseLoadStepForSession(state.domain, { plannedExerciseId, loadStepKg });
      if (transition.status === 'applied') {
        dispatch({ type: 'setExerciseLoadStep', domain: transition.domain });
      }
      return transition.status;
    },
    skipExercise: (input) => {
      const transition = skipExerciseForSession(state.domain, input);
      if (transition.status === 'skipped') dispatch({ type: 'skipExercise', domain: transition.domain });
      return transition.status;
    },
    undoExerciseSkip: (exerciseId) => {
      const transition = undoExerciseSkipForSession(state.domain, exerciseId);
      if (transition.status === 'undone') dispatch({ type: 'undoExerciseSkip', domain: transition.domain });
      return transition.status;
    },
    confirmExerciseBaselineSetup: (exerciseId) => {
      dispatch({ type: 'confirmExerciseBaselineSetup', exerciseId });
    },
    rescheduleCurrentQuest: (newDate, today) => {
      try {
        const roadmap = rescheduleRoadmapCurrentQuest(
          state.domain.roadmap,
          state.domain.progress.currentDayIndex,
          newDate,
          today,
        );
        if (roadmap === state.domain.roadmap) return 'unchanged';
        dispatch({ type: 'rescheduleCurrentQuest', roadmap });
        return 'rescheduled';
      } catch (error) {
        if (error instanceof CurrentQuestRescheduleError) return 'invalid';
        return 'invalid';
      }
    },
    saveWorkoutResult: (input) => {
      const validation = validateExerciseWorkoutResult(input);
      if (validation.valid) {
        dispatch({ type: 'saveWorkoutResult', result: validation.value });
      }
      return validation;
    },
    clearCurrentQuest: () => {
      const currentNode = progressView.currentDailyNode;
      if (currentNode === null) {
        dispatch({
          type: 'showValidationMessage',
          message: '現在進行できるDaily Questはありません。',
        });
        return null;
      }

      if (currentNode.type === 'training' && trainingPlan === null) {
        dispatch({
          type: 'showValidationMessage',
          message: 'Training Planを準備中です。Planが利用可能になるまでTraining Questは完了できません。',
        });
        return null;
      }

      const completion = currentNode.type === 'training'
        ? completeTrainingQuest(
          state.domain.roadmap,
          state.domain.progress,
          currentNode.dayIndex,
          trainingPlan ?? undefined,
          workoutResults,
          state.domain.equipmentProfile,
          exerciseSkips,
        )
        : completeRecoveryQuest(
          state.domain.roadmap,
          state.domain.progress,
          currentNode.dayIndex,
        );

      if (completion.status === 'completed') {
        dispatch({ type: 'completeQuest', dayIndex: currentNode.dayIndex });
      } else if (completion.status === 'not_ready_to_clear') {
        dispatch({
          type: 'showValidationMessage',
          message: 'すべての必須Exerciseを有効なWorkout Resultとして記録してください。',
        });
      } else {
        dispatch({
          type: 'showValidationMessage',
          message: '現在のQuestは完了できません。Mapから現在のQuestを開き直してください。',
        });
      }

      return completion;
    },
    continueAdventure: () => dispatch({ type: 'continueAdventure' }),
    navigateToHub: (screen) => dispatch({ type: 'navigateToHub', screen }),
  }), [bestActualMainE1rmKg, bossBattle, exerciseSkips, nextStagePlanningStrength, progressView, state, trainingEvaluation, workoutResults]);

  return (
    <AdventureQuestContext.Provider value={value}>
      {children}
    </AdventureQuestContext.Provider>
  );
}

export function useAdventureQuest(): AdventureQuestContextValue {
  const context = useContext(AdventureQuestContext);
  if (context === null) {
    throw new Error('useAdventureQuest must be used within AdventureQuestProvider.');
  }
  return context;
}

/** A nullable reader for standalone safe/empty screens outside a Session provider. */
export function useOptionalAdventureQuest(): AdventureQuestContextValue | null {
  return useContext(AdventureQuestContext);
}
