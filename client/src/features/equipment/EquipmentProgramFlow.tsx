import { useEffect, useRef, useState } from 'react';
import { getExerciseById, type EquipmentId } from '@fitness-rpg/shared';
import { requestStageTrainingProgram } from '../../application/stageTrainingProgram';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import {
  equipmentDraftFromEquipmentIds,
} from './equipmentDraft';
import {
  EquipmentCheckView,
  MainEquipmentMissingView,
  StageProgramErrorView,
  StageProgramGeneratingView,
} from './EquipmentFlow';
import {
  createStageProgramGenerationController,
  createStageTrainingProgramInput,
  type EquipmentProgramFlowState,
} from './stageProgramGeneration';

/** Connects the Figma-faithful Equipment states to the existing Client boundaries. */
export function EquipmentProgramFlow() {
  const {
    roadmap,
    equipmentProfile,
    stageTrainingProgramContext,
    setStageEquipmentProfile,
    cacheStageTrainingProgram,
    returnToMap,
  } = useAdventureQuest();
  const [flowState, setFlowState] = useState<EquipmentProgramFlowState>('equipment');
  const lastSubmittedEquipmentIds = useRef<readonly EquipmentId[] | null>(null);
  const latestDependencies = useRef({
    roadmap,
    stageTrainingProgramContext,
    setStageEquipmentProfile,
    cacheStageTrainingProgram,
  });
  latestDependencies.current = {
    roadmap,
    stageTrainingProgramContext,
    setStageEquipmentProfile,
    cacheStageTrainingProgram,
  };

  const controllerRef = useRef<ReturnType<typeof createStageProgramGenerationController> | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createStageProgramGenerationController({
      getRequestInput: (equipmentIds) => {
        const current = latestDependencies.current;
        return createStageTrainingProgramInput(
          current.stageTrainingProgramContext,
          current.roadmap,
          equipmentIds,
        );
      },
      setStageEquipmentProfile: (equipmentIds) =>
        latestDependencies.current.setStageEquipmentProfile(equipmentIds),
      requestStageTrainingProgram,
      cacheStageTrainingProgram: (program) =>
        latestDependencies.current.cacheStageTrainingProgram(program),
      onStateChange: setFlowState,
      onProgramReady: () => {},
    });
  }
  const controller = controllerRef.current;

  useEffect(() => () => controller.cancelActiveAttempt(), [controller]);

  function returnToAdventureMap() {
    controller.cancelActiveAttempt();
    returnToMap();
  }

  function submitEquipment(equipmentIds: readonly EquipmentId[]) {
    lastSubmittedEquipmentIds.current = equipmentIds;
    void controller.submit(equipmentIds);
  }

  if (flowState === 'generating') {
    return <StageProgramGeneratingView onBack={returnToAdventureMap} />;
  }
  if (flowState === 'error') {
    return (
      <StageProgramErrorView
        onRetry={() => {
          if (lastSubmittedEquipmentIds.current !== null) {
            void controller.submit(lastSubmittedEquipmentIds.current);
          }
        }}
        onBack={returnToAdventureMap}
      />
    );
  }
  if (flowState === 'main_equipment_missing') {
    const exercise = stageTrainingProgramContext === undefined
      ? undefined
      : getExerciseById(stageTrainingProgramContext.mainExerciseId);
    return (
      <MainEquipmentMissingView
        mainExerciseName={exercise?.displayName ?? 'MAIN STRENGTH'}
        onReselectEquipment={() => setFlowState('equipment')}
        onChangeMainStrength={() => {}}
        canChangeMainStrength={false}
      />
    );
  }

  return (
    <EquipmentCheckView
      key={equipmentProfile === undefined ? 'unset' : equipmentProfile.availableEquipmentIds.join('|')}
      initialDraft={equipmentDraftFromEquipmentIds(equipmentProfile?.availableEquipmentIds)}
      onBack={returnToAdventureMap}
      onSubmit={submitEquipment}
    />
  );
}
