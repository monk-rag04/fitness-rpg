import {
  completeRecoveryQuest,
  completeTrainingQuest,
  createInitialStageProgress,
  deriveStageProgressView,
  evaluateTrainingQuestCompletion,
  validateExerciseWorkoutResult,
  type GymEquipmentProfile,
  type ExerciseWorkoutResult,
  type QuestCompletionResult,
  type StageRoadmap,
  type StageProgress,
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
} from './adventureSession';

export { type AdventureQuestSession, createOnboardingAdventureSession } from './adventureSession';

export type AppScreen = 'map' | 'quest';

interface DomainState {
  readonly roadmap: StageRoadmap;
  readonly progress: StageProgress;
  readonly trainingPlan: ValidatedTrainingPlan | null;
  readonly equipmentProfile: GymEquipmentProfile | null;
  readonly workoutResultsByDay: Readonly<
    Record<number, Readonly<Record<string, ExerciseWorkoutResult>>>
  >;
}

interface EphemeralUiState {
  readonly screen: AppScreen;
  readonly isClearFeedbackVisible: boolean;
  readonly validationMessage: string | null;
}

interface AdventureQuestState {
  readonly domain: DomainState;
  readonly ui: EphemeralUiState;
}

type Action =
  | { readonly type: 'openCurrentQuest' }
  | { readonly type: 'returnToMap' }
  | { readonly type: 'saveWorkoutResult'; readonly result: ExerciseWorkoutResult }
  | { readonly type: 'completeQuest'; readonly progress: StageProgress }
  | { readonly type: 'showValidationMessage'; readonly message: string }
  | { readonly type: 'continueAdventure' };

export const DEMO_ADVENTURE_SESSION: AdventureQuestSession = {
  source: 'demo',
  roadmap: DEMO_STAGE_ROADMAP,
  initialProgress: createInitialStageProgress(DEMO_STAGE_ROADMAP),
  trainingPlan: DEMO_TRAINING_PLAN,
  equipmentProfile: DEMO_EQUIPMENT_PROFILE,
};

function createInitialState(session: AdventureQuestSession): AdventureQuestState {
  return {
    domain: {
      roadmap: session.roadmap,
      progress: session.initialProgress,
      trainingPlan: session.trainingPlan ?? null,
      equipmentProfile: session.equipmentProfile ?? null,
      workoutResultsByDay: {},
    },
    ui: {
      screen: 'map',
      isClearFeedbackVisible: false,
      validationMessage: null,
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
    case 'saveWorkoutResult': {
      const dayIndex = state.domain.progress.currentDayIndex;
      const resultsForDay = state.domain.workoutResultsByDay[dayIndex] ?? {};
      return {
        ...state,
        domain: {
          ...state.domain,
          workoutResultsByDay: {
            ...state.domain.workoutResultsByDay,
            [dayIndex]: {
              ...resultsForDay,
              [action.result.plannedExerciseId]: action.result,
            },
          },
        },
        ui: { ...state.ui, validationMessage: null },
      };
    }
    case 'completeQuest':
      return {
        ...state,
        domain: { ...state.domain, progress: action.progress },
        ui: { ...state.ui, isClearFeedbackVisible: true, validationMessage: null },
      };
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
  readonly workoutResults: readonly ExerciseWorkoutResult[];
  readonly trainingEvaluation: TrainingQuestCompletionEvaluation;
  readonly isClearFeedbackVisible: boolean;
  readonly validationMessage: string | null;
  openCurrentQuest: () => void;
  returnToMap: () => void;
  saveWorkoutResult: (input: unknown) => WorkoutResultValidationResult;
  clearCurrentQuest: () => QuestCompletionResult | null;
  continueAdventure: () => void;
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
  const progressView = deriveStageProgressView(state.domain.roadmap, state.domain.progress);
  const trainingEvaluation = evaluateTrainingQuestCompletion(
    state.domain.trainingPlan ?? undefined,
    workoutResults,
    state.domain.equipmentProfile ?? undefined,
  );

  const value = useMemo<AdventureQuestContextValue>(() => ({
    screen: state.ui.screen,
    roadmap: state.domain.roadmap,
    progress: state.domain.progress,
    progressView,
    trainingPlan: state.domain.trainingPlan,
    isTrainingPlanPending: state.domain.trainingPlan === null,
    workoutResults,
    trainingEvaluation,
    isClearFeedbackVisible: state.ui.isClearFeedbackVisible,
    validationMessage: state.ui.validationMessage,
    openCurrentQuest: () => {
      if (progressView.currentDailyNode !== null) {
        dispatch({ type: 'openCurrentQuest' });
      }
    },
    returnToMap: () => dispatch({ type: 'returnToMap' }),
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

      if (currentNode.type === 'training' && state.domain.trainingPlan === null) {
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
          state.domain.trainingPlan ?? undefined,
          workoutResults,
          state.domain.equipmentProfile ?? undefined,
        )
        : completeRecoveryQuest(
          state.domain.roadmap,
          state.domain.progress,
          currentNode.dayIndex,
        );

      if (completion.status === 'completed') {
        dispatch({ type: 'completeQuest', progress: completion.progress });
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
  }), [progressView, state, trainingEvaluation, workoutResults]);

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
