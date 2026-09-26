import { useEffect, useRef, useState } from 'react';
import type { EquipmentId } from '@fitness-rpg/shared';
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
import { exerciseLabel } from '../../presentation/trainingLabels';

/** Connects the existing Production Equipment states to the Stage Program boundary. */
export function EquipmentProgramFlow() {
  const {
    roadmap,
    stageNumber,
    equipmentProfile,
    stageTrainingProgramContext,
    setStageEquipmentProfile,
    cacheStageTrainingProgram,
    returnToMap,
  } = useAdventureQuest();
  const [flowState, setFlowState] = useState<EquipmentProgramFlowState>('equipment');
  const [reuseEquipmentProfile, setReuseEquipmentProfile] = useState(equipmentProfile !== undefined && stageNumber > 1);
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
    return (
      <MainEquipmentMissingView
        mainExerciseName={stageTrainingProgramContext === undefined
          ? 'MAIN STRENGTH'
          : exerciseLabel(stageTrainingProgramContext.mainExerciseId)}
        onReselectEquipment={() => { setReuseEquipmentProfile(false); setFlowState('equipment'); }}
        onChangeMainStrength={() => {}}
        canChangeMainStrength={false}
      />
    );
  }

  if (reuseEquipmentProfile && equipmentProfile !== undefined) {
    return (
      <section className="screen equipment-flow-screen equipment-program-start" aria-labelledby="stage-program-start-title">
        <div className="equipment-flow-center">
          <div className="equipment-flow-emblem equipment-flow-emblem--gold" aria-hidden="true">✦</div>
          <p className="equipment-flow-eyebrow">STAGE PROGRAM</p>
          <h1 id="stage-program-start-title">Stageのメニューを準備</h1>
          <p className="equipment-flow-description">前StageのEquipment設定を引き継いで、このStageのトレーニングメニューを作成します。</p>
          <div className="equipment-flow-actions">
            <button
              className="quest-gold-button"
              type="button"
              onClick={() => submitEquipment(equipmentProfile.availableEquipmentIds)}
            >
              このStageのトレーニングメニューを作成
            </button>
            <button className="equipment-flow-back" type="button" onClick={returnToAdventureMap}>MAPへ戻る</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <EquipmentCheckView
      key={equipmentProfile === undefined ? 'unset' : equipmentProfile.availableEquipmentIds.join('|')}
      mainExerciseId={roadmap.mainExerciseId}
      initialDraft={equipmentDraftFromEquipmentIds(equipmentProfile?.availableEquipmentIds)}
      onBack={returnToAdventureMap}
      onSubmit={submitEquipment}
    />
  );
}
