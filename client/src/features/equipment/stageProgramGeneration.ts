import type {
  EquipmentId,
  StageRoadmap,
  ValidatedStageTrainingProgram,
} from '@fitness-rpg/shared';
import type {
  StageTrainingProgramApplicationInput,
  StageTrainingProgramApplicationResult,
} from '../../application/stageTrainingProgram';
import type {
  StageEquipmentProfileStatus,
  StageTrainingProgramCacheStatus,
  StageTrainingProgramSessionContext,
} from '../../state/adventureSession';

export type EquipmentProgramFlowState =
  | 'equipment'
  | 'generating'
  | 'error'
  | 'main_equipment_missing';

export function createStageTrainingProgramInput(
  context: StageTrainingProgramSessionContext | undefined,
  roadmap: StageRoadmap,
  equipmentIds: readonly EquipmentId[],
): StageTrainingProgramApplicationInput | null {
  if (context === undefined) return null;
  return {
    equipmentIds,
    mainExerciseId: context.mainExerciseId,
    currentE1rmKg: context.currentE1rmKg,
    stageTargetE1rmKg: roadmap.stageTargetE1rmKg,
    trainingExperienceMonths: context.trainingExperienceMonths,
    trainingFrequencyPerWeek: context.trainingFrequencyPerWeek,
    roadmap,
  };
}

interface StageProgramGenerationDependencies {
  readonly getRequestInput: (equipmentIds: readonly EquipmentId[]) => StageTrainingProgramApplicationInput | null;
  readonly setStageEquipmentProfile: (equipmentIds: readonly EquipmentId[]) => StageEquipmentProfileStatus;
  readonly requestStageTrainingProgram: (
    input: StageTrainingProgramApplicationInput,
  ) => Promise<StageTrainingProgramApplicationResult>;
  readonly cacheStageTrainingProgram: (
    program: ValidatedStageTrainingProgram,
  ) => StageTrainingProgramCacheStatus;
  readonly onStateChange: (state: Exclude<EquipmentProgramFlowState, 'equipment'>) => void;
  readonly onProgramReady: () => void;
}

/**
 * Coordinates one explicit Stage Program generation attempt. It keeps request
 * sequencing outside presentational components and never caches a stale result.
 */
export function createStageProgramGenerationController(
  dependencies: StageProgramGenerationDependencies,
) {
  let latestAttemptId = 0;
  let inFlight = false;
  let disposed = false;

  function isCurrent(attemptId: number): boolean {
    return !disposed && attemptId === latestAttemptId;
  }

  function finishWith(attemptId: number, state: Exclude<EquipmentProgramFlowState, 'equipment'>): void {
    if (!isCurrent(attemptId)) return;
    inFlight = false;
    dependencies.onStateChange(state);
  }

  return {
    get isInFlight(): boolean {
      return inFlight;
    },
    cancelActiveAttempt(): void {
      latestAttemptId += 1;
      inFlight = false;
    },
    dispose(): void {
      disposed = true;
      latestAttemptId += 1;
      inFlight = false;
    },
    async submit(equipmentIds: readonly EquipmentId[]): Promise<void> {
      if (disposed || inFlight) return;

      const attemptId = ++latestAttemptId;
      inFlight = true;
      const input = dependencies.getRequestInput(equipmentIds);
      if (input === null) {
        finishWith(attemptId, 'error');
        return;
      }

      const profileStatus = dependencies.setStageEquipmentProfile(equipmentIds);
      if (profileStatus !== 'set' && profileStatus !== 'already_set') {
        finishWith(attemptId, 'error');
        return;
      }

      dependencies.onStateChange('generating');
      let result: StageTrainingProgramApplicationResult;
      try {
        result = await dependencies.requestStageTrainingProgram(input);
      } catch {
        finishWith(attemptId, 'error');
        return;
      }
      if (!isCurrent(attemptId)) return;

      if (result.status === 'stage_training_program_ready') {
        const cacheStatus = dependencies.cacheStageTrainingProgram(result.program);
        if (cacheStatus === 'cached') {
          inFlight = false;
          dependencies.onProgramReady();
        } else {
          finishWith(attemptId, 'error');
        }
        return;
      }

      finishWith(
        attemptId,
        result.code === 'main_exercise_unavailable' ? 'main_equipment_missing' : 'error',
      );
    },
  };
}
