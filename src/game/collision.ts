import type { GameConfig, Point } from './types.ts';

export interface ObstacleHit extends Point {
  readonly time: number;
}

export function segmentCircleHit(from: Point, to: Point, center: Point, radius: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const offsetX = from.x - center.x;
  const offsetY = from.y - center.y;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (offsetX * dx + offsetY * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : null;
}

export function findProjectileObstacle(from: Point, to: Point, radius: number, config: GameConfig): ObstacleHit | null {
  let firstTime: number | null = null;
  const minX = radius;
  const maxX = config.arena.width - radius;
  const minY = radius;
  const maxY = config.arena.height - radius;

  if (from.x < minX || from.x > maxX || from.y < minY || from.y > maxY) {
    return { ...from, time: 0 };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const candidates = [
    to.x < minX ? (minX - from.x) / dx : null,
    to.x > maxX ? (maxX - from.x) / dx : null,
    to.y < minY ? (minY - from.y) / dy : null,
    to.y > maxY ? (maxY - from.y) / dy : null,
    ...config.islands.map((island) => segmentCircleHit(from, to, island, island.radius + radius)),
  ];

  for (const time of candidates) {
    if (time !== null && time >= 0 && time <= 1 && (firstTime === null || time < firstTime)) firstTime = time;
  }

  return firstTime === null ? null : {
    x: from.x + dx * firstTime,
    y: from.y + dy * firstTime,
    time: firstTime,
  };
}

export function isPositionBlocked(point: Point, radius: number, config: GameConfig): boolean {
  return point.x < radius || point.y < radius
    || point.x > config.arena.width - radius
    || point.y > config.arena.height - radius
    || config.islands.some((island) => Math.hypot(point.x - island.x, point.y - island.y) < radius + island.radius);
}

export function resolveMovement(from: Point, to: Point, radius: number, config: GameConfig): Point {
  const bounded = {
    x: Math.max(radius, Math.min(config.arena.width - radius, to.x)),
    y: Math.max(radius, Math.min(config.arena.height - radius, to.y)),
  };

  if (!isPositionBlocked(bounded, radius, config)) return bounded;
  const horizontal = { x: bounded.x, y: from.y };
  if (!isPositionBlocked(horizontal, radius, config)) return horizontal;
  const vertical = { x: from.x, y: bounded.y };
  return !isPositionBlocked(vertical, radius, config) ? vertical : from;
}
