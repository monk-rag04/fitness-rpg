import {
  compareLocalDates,
  isValidLocalDate,
} from '@fitness-rpg/shared';

export interface RescheduleQuestSheetProps {
  readonly currentDate: string;
  readonly minimumDate: string;
  readonly selectedDate: string;
  readonly hasError: boolean;
  readonly onDateChange: (date: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RescheduleQuestSheet({
  currentDate,
  minimumDate,
  selectedDate,
  hasError,
  onDateChange,
  onConfirm,
  onCancel,
}: RescheduleQuestSheetProps) {
  const canConfirm = isValidLocalDate(currentDate) &&
    isValidLocalDate(minimumDate) &&
    isValidLocalDate(selectedDate) &&
    compareLocalDates(selectedDate, currentDate) > 0 &&
    compareLocalDates(selectedDate, minimumDate) >= 0;

  return (
    <div className="quest-reschedule-backdrop">
      <section
        className="quest-reschedule-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-reschedule-title"
      >
        <p className="quest-reschedule-sheet__eyebrow">SCHEDULE UPDATE</p>
        <h2 id="quest-reschedule-title">QUESTの日程を変更</h2>
        <div className="quest-reschedule-date-summary">
          <span>現在の予定日</span>
          <strong>{formatLocalDateJapanese(currentDate)}</strong>
        </div>
        <label className="quest-reschedule-date-field" htmlFor="quest-reschedule-date">
          変更後の日付
          <input
            id="quest-reschedule-date"
            type="date"
            value={selectedDate}
            min={minimumDate}
            onChange={(event) => onDateChange(event.currentTarget.value)}
          />
        </label>
        <p className="quest-reschedule-sheet__description">
          選択した日付まで現在のQUESTと、それ以降の予定が後ろにずれます。
        </p>
        <p className="quest-reschedule-sheet__note">進行状況やトレーニング内容は変わりません。</p>
        {hasError && (
          <p className="quest-reschedule-sheet__error" role="alert">
            選択した日付には変更できません。
          </p>
        )}
        <button
          className="quest-gold-button quest-reschedule-sheet__confirm"
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          この日付に変更
        </button>
        <button
          className="quest-reschedule-sheet__cancel"
          type="button"
          onClick={onCancel}
        >
          キャンセル
        </button>
      </section>
    </div>
  );
}

function formatLocalDateJapanese(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
