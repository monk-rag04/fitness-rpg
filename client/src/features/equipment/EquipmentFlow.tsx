import { useState } from 'react';
import {
  BASIC_STAGE_EQUIPMENT_IDS,
  MIN_BASIC_STAGE_EQUIPMENT_COUNT,
  OPTIONAL_STAGE_EQUIPMENT_IDS,
  evaluateStageEquipmentReadiness,
  type EquipmentId,
} from '@fitness-rpg/shared';
import { QuestGoldButton, QuestOrnateFrame, QuestSectionTitle } from '../../components/QuestUi';
import { equipmentLabel } from '../../presentation/trainingLabels';
import {
  INITIAL_EQUIPMENT_DRAFT,
  type EquipmentDraft,
  equipmentIdsForSubmission,
  submitEquipmentDraft,
  toggleEquipment,
} from './equipmentDraft';

export function EquipmentCheckView({
  initialDraft = INITIAL_EQUIPMENT_DRAFT,
  mainExerciseId,
  onBack,
  onSubmit,
}: {
  readonly initialDraft?: EquipmentDraft;
  readonly mainExerciseId: string;
  readonly onBack: () => void;
  readonly onSubmit: (equipmentIds: readonly EquipmentId[]) => void;
}) {
  const [draft, setDraft] = useState<EquipmentDraft>(initialDraft);
  return <EquipmentCheckContent draft={draft} mainExerciseId={mainExerciseId} onDraftChange={setDraft} onBack={onBack} onSubmit={onSubmit} />;
}

export function EquipmentCheckContent({
  draft,
  mainExerciseId,
  onDraftChange,
  onBack,
  onSubmit,
}: {
  readonly draft: EquipmentDraft;
  readonly mainExerciseId: string;
  readonly onDraftChange: (draft: EquipmentDraft) => void;
  readonly onBack: () => void;
  readonly onSubmit: (equipmentIds: readonly EquipmentId[]) => void;
}) {
  const equipmentIds = equipmentIdsForSubmission(draft);
  const readiness = evaluateStageEquipmentReadiness(mainExerciseId, equipmentIds ?? []);

  function equipmentChoice(equipmentId: EquipmentId) {
    const selected = draft.kind === 'equipment' && draft.equipmentIds.includes(equipmentId);
    const required = readiness.mainRequiredEquipmentIds.includes(equipmentId);
    return (
      <button
        key={equipmentId}
        className={`equipment-choice ${selected ? 'is-selected' : ''}`}
        type="button"
        aria-pressed={selected}
        onClick={() => onDraftChange(toggleEquipment(draft, equipmentId))}
      >
        <span className="equipment-choice-mark" aria-hidden="true">{selected ? '✓' : '+'}</span>
        <span className="equipment-choice-label">{equipmentLabel(equipmentId)}</span>
        {required && <span className="equipment-choice-required">メイン種目に必要</span>}
      </button>
    );
  }

  return (
    <section className="equipment-check-screen" aria-labelledby="equipment-check-title">
      <button className="back-button equipment-check-back" type="button" onClick={onBack}>← Adventure Mapへ戻る</button>
      <header className="equipment-check-header">
        <div>
          <p className="equipment-check-eyebrow">STAGEの装備</p>
          <h1 id="equipment-check-title">EQUIPMENT CHECK</h1>
        </div>
        <span className="quest-type-tag equipment-check-tag"><span aria-hidden="true">✦</span>器具</span>
      </header>

      <div className="equipment-check-info">
        <strong>利用可能な器具</strong>
        <p>基本器具を2つ以上選び、メイン種目に必要な器具を揃えてください。</p>
      </div>

      <QuestOrnateFrame className="equipment-check-frame">
        <div className="equipment-check-section-heading">
          <QuestSectionTitle>基本器具</QuestSectionTitle>
          <span className="equipment-check-count">{readiness.selectedBasicCount} / {MIN_BASIC_STAGE_EQUIPMENT_COUNT} 選択済み</span>
        </div>
        <p className="equipment-check-group-note">2つ以上選択してください。メイン種目に必要な器具も数に含まれます。</p>
        <div className="equipment-check-grid" aria-label="基本器具">
          {BASIC_STAGE_EQUIPMENT_IDS.map(equipmentChoice)}
        </div>
        <div className="equipment-check-section-heading equipment-check-section-heading--optional">
          <QuestSectionTitle>追加器具（任意）</QuestSectionTitle>
        </div>
        <div className="equipment-check-grid" aria-label="追加器具">
          {OPTIONAL_STAGE_EQUIPMENT_IDS.map(equipmentChoice)}
        </div>
      </QuestOrnateFrame>

      <div className="equipment-check-bodyweight-info">
        <strong>✓ 自重トレーニングは常に利用できます</strong>
        <p>プッシュアップなどは器具選択なしで候補になります。懸垂は懸垂バーが必要です。</p>
      </div>

      <footer className="equipment-check-footer">
        {!readiness.mainAvailable && readiness.missingMainEquipmentIds.length > 0 && (
          <p className="equipment-check-requirement" role="status">
            メイン種目に必要な器具：{readiness.missingMainEquipmentIds.map(equipmentLabel).join('・')}
          </p>
        )}
        <QuestGoldButton type="button" disabled={!readiness.ready} onClick={() => {
          if (readiness.ready) submitEquipmentDraft(draft, onSubmit);
        }}>
          この装備でクエストを生成
        </QuestGoldButton>
        <p>選択した器具をもとに、このStageのTraining Questを準備します。</p>
      </footer>
    </section>
  );
}

function StageProgramBack({ onBack }: { readonly onBack: () => void }) {
  return <button className="equipment-flow-back" type="button" onClick={onBack}>Adventure Mapへ戻る</button>;
}

export function StageProgramGeneratingView({ onBack }: { readonly onBack: () => void }) {
  return (
    <section className="equipment-flow-screen" aria-labelledby="stage-program-generating-title" role="status">
      <div className="equipment-flow-center">
        <span className="equipment-flow-emblem equipment-flow-emblem--blue" aria-hidden="true">✦</span>
        <p className="equipment-flow-eyebrow">STAGE PROGRAM GENERATING</p>
        <h1 id="stage-program-generating-title">トレーニングプログラムを<br />編成しています</h1>
        <p className="equipment-flow-description">選択した器具とStage目標をもとに、このStageのトレーニングプログラムを編成しています。</p>
        <QuestOrnateFrame className="equipment-flow-status">
          <span className="equipment-flow-status-dot" aria-hidden="true" />
          <div><strong>STAGE PROGRAM</strong><p>編成が完了するまでお待ちください</p></div>
        </QuestOrnateFrame>
      </div>
      <StageProgramBack onBack={onBack} />
    </section>
  );
}

export function StageProgramErrorView({
  onRetry,
  onBack,
}: {
  readonly onRetry: () => void;
  readonly onBack: () => void;
}) {
  return (
    <section className="equipment-flow-screen" aria-labelledby="stage-program-error-title">
      <div className="equipment-flow-center">
        <span className="equipment-flow-emblem equipment-flow-emblem--red" aria-hidden="true">!</span>
        <p className="equipment-flow-eyebrow equipment-flow-eyebrow--red">PROGRAM GENERATION FAILED</p>
        <h1 id="stage-program-error-title">トレーニングプログラムの<br />編成に失敗しました</h1>
        <p className="equipment-flow-description">編成中に問題が発生しました。選択した器具は保持されています。</p>
      </div>
      <footer className="equipment-flow-actions">
        <QuestGoldButton type="button" onClick={onRetry}>もう一度試す</QuestGoldButton>
        <StageProgramBack onBack={onBack} />
      </footer>
    </section>
  );
}

export function StageProgramEquipmentConstraintView({
  onReselectEquipment,
  onBack,
}: {
  readonly onReselectEquipment: () => void;
  readonly onBack: () => void;
}) {
  return (
    <section className="equipment-flow-screen" aria-labelledby="stage-program-equipment-title">
      <div className="equipment-flow-center">
        <span className="equipment-flow-emblem equipment-flow-emblem--gold" aria-hidden="true">⚒</span>
        <p className="equipment-flow-eyebrow">EQUIPMENT CHECK</p>
        <h1 id="stage-program-equipment-title">この器具構成では<br />メニューを作成できません</h1>
        <p className="equipment-flow-description">選んだ器具で実施できる種目が不足しています。器具を追加して、もう一度お試しください。</p>
      </div>
      <footer className="equipment-flow-actions">
        <QuestGoldButton type="button" onClick={onReselectEquipment}>器具を選び直す</QuestGoldButton>
        <StageProgramBack onBack={onBack} />
      </footer>
    </section>
  );
}

export function MainEquipmentMissingView({
  mainExerciseName,
  onReselectEquipment,
  onChangeMainStrength,
  canChangeMainStrength = true,
}: {
  readonly mainExerciseName: string;
  readonly onReselectEquipment: () => void;
  readonly onChangeMainStrength: () => void;
  readonly canChangeMainStrength?: boolean;
}) {
  return (
    <section className="equipment-flow-screen" aria-labelledby="main-equipment-missing-title">
      <div className="equipment-flow-center">
        <span className="equipment-flow-emblem equipment-flow-emblem--gold" aria-hidden="true">⚔︎</span>
        <p className="equipment-flow-eyebrow">MAIN EQUIPMENT MISSING</p>
        <h1 id="main-equipment-missing-title">この種目に必要な<br />器具がありません</h1>
        <QuestOrnateFrame className="equipment-flow-main-card">
          <strong>MAIN STRENGTH</strong>
          <h2>{mainExerciseName}</h2>
          <p>現在の器具では、このメイン種目を実施できません。</p>
        </QuestOrnateFrame>
      </div>
      <footer className="equipment-flow-actions">
        <QuestGoldButton type="button" onClick={onReselectEquipment}>装備を選び直す</QuestGoldButton>
        <button className="equipment-flow-back" type="button" disabled={!canChangeMainStrength} onClick={onChangeMainStrength}>Main Strengthを変更する</button>
      </footer>
    </section>
  );
}
