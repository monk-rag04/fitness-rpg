import { useState } from 'react';
import { EQUIPMENT_CATALOG, type EquipmentId } from '@fitness-rpg/shared';
import { QuestGoldButton, QuestOrnateFrame, QuestSectionTitle } from '../../components/QuestUi';
import {
  INITIAL_EQUIPMENT_DRAFT,
  type EquipmentDraft,
  equipmentIdsForSubmission,
  selectedChoiceCount,
  submitEquipmentDraft,
  toggleEquipment,
  toggleNoEquipment,
} from './equipmentDraft';

function equipmentSubtitle(displayName: string): string {
  return displayName.replace(/ Machine$/, '').replace(/^Adjustable Bench$/, 'Adjustable').toUpperCase();
}

export function EquipmentCheckView({
  onBack,
  onSubmit,
}: {
  readonly onBack: () => void;
  readonly onSubmit: (equipmentIds: readonly EquipmentId[]) => void;
}) {
  const [draft, setDraft] = useState<EquipmentDraft>(INITIAL_EQUIPMENT_DRAFT);
  return <EquipmentCheckContent draft={draft} onDraftChange={setDraft} onBack={onBack} onSubmit={onSubmit} />;
}

export function EquipmentCheckContent({
  draft,
  onDraftChange,
  onBack,
  onSubmit,
}: {
  readonly draft: EquipmentDraft;
  readonly onDraftChange: (draft: EquipmentDraft) => void;
  readonly onBack: () => void;
  readonly onSubmit: (equipmentIds: readonly EquipmentId[]) => void;
}) {
  const equipmentIds = equipmentIdsForSubmission(draft);

  return (
    <section className="equipment-check-screen" aria-labelledby="equipment-check-title">
      <button className="back-button equipment-check-back" type="button" onClick={onBack}>← Adventure Mapへ戻る</button>
      <header className="equipment-check-header">
        <div>
          <p className="equipment-check-eyebrow">STAGE LOADOUT</p>
          <h1 id="equipment-check-title">EQUIPMENT CHECK</h1>
        </div>
        <span className="quest-type-tag equipment-check-tag"><span aria-hidden="true">✦</span>GEAR</span>
      </header>

      <div className="equipment-check-info">
        <strong>AVAILABLE GEAR</strong>
        <p>このStageで利用できる設備を登録してください。複数選択できます。</p>
      </div>

      <QuestOrnateFrame className="equipment-check-frame">
        <div className="equipment-check-section-heading">
          <QuestSectionTitle>AVAILABLE GEAR</QuestSectionTitle>
          <span className="equipment-check-count">{selectedChoiceCount(draft)} SELECTED</span>
        </div>
        <div className="equipment-check-grid" aria-label="利用可能な器具">
          {EQUIPMENT_CATALOG.map((equipment) => {
            const selected = draft.kind === 'equipment' && draft.equipmentIds.includes(equipment.id);
            return (
              <button
                key={equipment.id}
                className={`equipment-choice ${selected ? 'is-selected' : ''}`}
                type="button"
                aria-pressed={selected}
                onClick={() => onDraftChange(toggleEquipment(draft, equipment.id))}
              >
                <span className="equipment-choice-mark" aria-hidden="true">{selected ? '✓' : '+'}</span>
                <span className="equipment-choice-label">{equipment.displayName}</span>
                <small>{equipmentSubtitle(equipment.displayName)}</small>
              </button>
            );
          })}
          <button
            className={`equipment-choice equipment-choice--none ${draft.kind === 'no_equipment' ? 'is-selected' : ''}`}
            type="button"
            aria-pressed={draft.kind === 'no_equipment'}
            onClick={() => onDraftChange(toggleNoEquipment(draft))}
          >
            <span className="equipment-choice-mark" aria-hidden="true">{draft.kind === 'no_equipment' ? '✓' : '−'}</span>
            <span className="equipment-choice-label">器具なし</span>
            <small>NO EQUIPMENT</small>
            <span className="equipment-choice-note">他の選択を解除</span>
          </button>
        </div>
      </QuestOrnateFrame>

      <footer className="equipment-check-footer">
        <QuestGoldButton type="button" disabled={equipmentIds === null} onClick={() => {
          submitEquipmentDraft(draft, onSubmit);
        }}>
          この装備でクエストを生成
        </QuestGoldButton>
        <p>登録した設備だけを使って、このStageのTraining Questを準備します。</p>
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
        <h1 id="stage-program-generating-title">TRAINING<br />PROGRAMを<br />編成しています</h1>
        <p className="equipment-flow-description">登録された装備とStage目標をもとに、このStageのTraining Programを準備しています。</p>
        <QuestOrnateFrame className="equipment-flow-status">
          <span className="equipment-flow-status-dot" aria-hidden="true" />
          <div><strong>PREPARING STAGE PROGRAM</strong><p>編成が完了するまでお待ちください</p></div>
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
        <h1 id="stage-program-error-title">TRAINING PROGRAMを<br />編成できませんでした</h1>
        <p className="equipment-flow-description">Stage Programの準備中に問題が発生しました。登録した設備は保持されています。</p>
      </div>
      <footer className="equipment-flow-actions">
        <QuestGoldButton type="button" onClick={onRetry}>もう一度試す</QuestGoldButton>
        <StageProgramBack onBack={onBack} />
      </footer>
    </section>
  );
}

export function MainEquipmentMissingView({
  mainExerciseName,
  onReselectEquipment,
  onChangeMainStrength,
}: {
  readonly mainExerciseName: string;
  readonly onReselectEquipment: () => void;
  readonly onChangeMainStrength: () => void;
}) {
  return (
    <section className="equipment-flow-screen" aria-labelledby="main-equipment-missing-title">
      <div className="equipment-flow-center">
        <span className="equipment-flow-emblem equipment-flow-emblem--gold" aria-hidden="true">⚔︎</span>
        <p className="equipment-flow-eyebrow">MAIN EQUIPMENT MISSING</p>
        <h1 id="main-equipment-missing-title">MAIN STRENGTHに必要な<br />装備がありません</h1>
        <QuestOrnateFrame className="equipment-flow-main-card">
          <strong>MAIN STRENGTH</strong>
          <h2>{mainExerciseName}</h2>
          <p>現在選択されている装備では、このMain Strength Exerciseを実行できません。</p>
        </QuestOrnateFrame>
      </div>
      <footer className="equipment-flow-actions">
        <QuestGoldButton type="button" onClick={onReselectEquipment}>装備を選び直す</QuestGoldButton>
        <button className="equipment-flow-back" type="button" onClick={onChangeMainStrength}>Main Strengthを変更する</button>
      </footer>
    </section>
  );
}
