import { useLayoutEffect, useMemo, useRef } from 'react';
import type { StageProgressDailyNodeView } from '@fitness-rpg/shared';
// Same Unsplash terrain source as figma-reference/src/game/images.ts; bundled locally for Production.
import mapTerrain from '../../assets/map-terrain.jpg';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { MapNode } from './MapNode';

interface Point {
  readonly x: number;
  readonly y: number;
}

function routePoints(nodeCount: number, mapHeight: number): Point[] {
  const travel = mapHeight - 190;
  return Array.from({ length: nodeCount }, (_, index) => {
    const progress = nodeCount === 1 ? 1 : index / (nodeCount - 1);
    const sway = Math.sin(index * 1.72) * 23 + Math.cos(index * 0.51) * 7;
    return { x: 50 + sway, y: mapHeight - 80 - progress * travel };
  });
}

function pointString(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function MapGauge({ completed, total }: { readonly completed: number; readonly total: number }) {
  const percent = total === 0 ? 0 : (completed / total) * 100;
  return (
    <div className="map-gauge">
      <div className="map-gauge-label">STAGE PROGRESS</div>
      <div
        className="map-gauge-track"
        role="progressbar"
        aria-label="Stage progress"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="map-gauge-fill" style={{ width: `${percent}%` }} />
        <div className="map-gauge-sheen" />
      </div>
    </div>
  );
}

export function AdventureMap() {
  const { roadmap, progressView, openCurrentQuest, openBossBattle, openStageClear, bossBattle, stageNumber } = useAdventureQuest();
  const dailyNodes: readonly StageProgressDailyNodeView[] = progressView.dailyNodes;
  const nodeCount = dailyNodes.length + 1; // Boss follows the daily route.
  const mapHeight = Math.max(720, nodeCount * 76 + 170);
  const mapCanvasHeight = mapHeight + 48;
  const points = useMemo(() => routePoints(nodeCount, mapHeight), [nodeCount, mapHeight]);
  const currentNodeRef = useRef<HTMLDivElement>(null);
  const clearedRoutePoints = progressView.bossAvailable
    ? points
    : points.slice(0, progressView.currentDayIndex + 1);
  const remaining = progressView.totalDailyNodeCount - progressView.completedDailyNodeCount;

  useLayoutEffect(() => {
    // scrollIntoView would scroll the overflow-hidden canvas internally, leaving its image displaced.
    // Scroll the page after layout instead; repeat once after paint for browser scroll restoration.
    let secondFrame: number | undefined;
    const scrollToCurrent = () => {
      const currentNode = currentNodeRef.current;
      if (currentNode === null) return;
      const rect = currentNode.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const target = window.scrollY + rect.top + rect.height / 2 - viewportHeight / 2;
      window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
    };
    scrollToCurrent();
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(scrollToCurrent);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [progressView.currentDayIndex]);

  return (
    <section className="adventure-map" aria-labelledby="map-title">
      <header className="map-header">
        <div className="map-header-top">
          <div>
            <p className="map-eyebrow">STAGE {stageNumber} · ADVENTURE MAP</p>
            <h1 id="map-title" className="map-title">Iron Vale Ascent</h1>
          </div>
          <span className="map-tag map-tag--danger">BOSSまで {remaining} QUEST</span>
        </div>
        <div className="map-header-progress">
          <MapGauge completed={progressView.completedDailyNodeCount} total={progressView.totalDailyNodeCount} />
          <p className="map-header-detail">
            攻略期間：{roadmap.durationDays}日 · 目標 e1RM {roadmap.stageTargetE1rmKg}kg
          </p>
        </div>
      </header>

      <section className="map-canvas" style={{ height: mapCanvasHeight }} aria-label="Stage adventure route">
        <img className="map-terrain" src={mapTerrain} alt="霧深い山と森が続く冒険の地図" />
        <div className="map-terrain-shade" aria-hidden="true" />
        <div className="map-terrain-arcane" aria-hidden="true" />
        <div className="map-terrain-vale" aria-hidden="true" />

        <div className="map-landmark map-landmark--ruin" aria-hidden="true">
          <span className="map-landmark-icon">♜</span><span>RUIN KEEP</span>
        </div>
        <div className="map-landmark map-landmark--dusk" aria-hidden="true">
          <span className="map-landmark-icon">♠</span><span>DUSKWOOD</span>
        </div>
        <div className="map-landmark map-landmark--mist" aria-hidden="true">
          <span className="map-landmark-icon">≈</span><span>MIST VALE</span>
        </div>

        <svg className="map-route" style={{ height: mapHeight }} viewBox={`0 0 100 ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pointString(points)} fill="none" stroke="rgba(201,162,75,.38)" strokeWidth="1.35" strokeDasharray="1.8 2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <polyline points={pointString(clearedRoutePoints)} fill="none" stroke="rgba(233,200,118,.98)" strokeWidth="1.65" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {dailyNodes.map((node, index) => (
          <div
            key={node.dayIndex}
            ref={node.status === 'available' ? currentNodeRef : undefined}
            className="map-position"
            style={{ left: `${points[index].x}%`, top: points[index].y }}
          >
            <MapNode node={node} onOpen={openCurrentQuest} />
          </div>
        ))}
        <div
          ref={progressView.bossAvailable ? currentNodeRef : undefined}
          className="map-position map-position--boss"
          style={{ left: `${points[nodeCount - 1].x}%`, top: points[nodeCount - 1].y }}
        >
          <MapNode
            boss={progressView.boss}
            bossAvailable={progressView.bossAvailable}
            bossDefeated={bossBattle?.defeated === true}
            onOpen={() => {
              if (bossBattle?.defeated === true) openStageClear();
              else openBossBattle();
            }}
          />
        </div>

        <div className="map-bottom-shade" aria-hidden="true" />
        <p className="map-help">金色に光る <span>YOU</span> を選ぶと、本日のQuestへ進みます。</p>
      </section>
    </section>
  );
}
