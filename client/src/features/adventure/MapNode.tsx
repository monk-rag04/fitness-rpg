import type { StageProgressDailyNodeView, StageRoadmap } from '@fitness-rpg/shared';

type DailyProps = {
  readonly node: StageProgressDailyNodeView;
  readonly onOpen: () => void;
  readonly boss?: never;
  readonly bossAvailable?: never;
  readonly bossDefeated?: never;
};

type BossProps = {
  readonly boss: StageRoadmap['boss'];
  readonly bossAvailable: boolean;
  readonly bossDefeated: boolean;
  readonly onOpen: () => void;
  readonly node?: never;
};

export function MapNode(props: DailyProps | BossProps) {
  const boss = props.boss !== undefined;
  const current = !boss && props.node.status === 'available';
  const complete = boss ? props.bossDefeated : props.node.status === 'completed';
  const locked = boss ? !props.bossAvailable : props.node.status === 'locked';
  const type = boss ? 'boss' : props.node.type;
  const icon = complete ? '✓' : type === 'training' ? '⚔' : type === 'recovery' ? '☾' : '♛';
  const label = boss ? (props.bossDefeated ? 'STAGE CLEAR' : 'STAGE BOSS') : type === 'training' ? 'TRAINING QUEST' : 'RECOVERY QUEST';
  const date = boss ? props.boss.date : props.node.date;
  const className = [
    'map-node',
    `map-node--${type}`,
    complete && 'map-node--completed',
    current && 'map-node--current',
    locked && 'map-node--locked',
    boss && props.bossAvailable && 'map-node--boss-available',
    boss && props.bossDefeated && 'map-node--completed',
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {boss && <span className="map-node-destination">THE CITADEL</span>}
      <span className="map-node-ring">
        {icon}
        {current && <span className="map-node-pulse" aria-hidden="true" />}
      </span>
      <span className="map-node-caption">
        <span className="map-node-name">{label}</span>
        <span className="map-node-date">{date}</span>
      </span>
      {current && <span className="map-node-you">YOU</span>}
    </>
  );

  if (current || (boss && props.bossAvailable)) {
    return (
      <button className={className} type="button" onClick={props.onOpen} aria-current="step" aria-label={`${label} ${date}、本日のQuestを開く`}>
        {content}
      </button>
    );
  }

  return <div className={className} aria-label={`${label} ${date}、${boss && props.bossAvailable ? 'Boss available' : complete ? '完了' : '未解放'}`}>{content}</div>;
}
