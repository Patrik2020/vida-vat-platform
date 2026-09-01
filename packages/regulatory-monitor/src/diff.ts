import type { DiffExcerpt } from './types.js';

function frequencies(lines: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const line of lines) result.set(line, (result.get(line) ?? 0) + 1);
  return result;
}

function multisetDifference(left: readonly string[], right: readonly string[], limit: number): string[] {
  const rightCounts = frequencies(right);
  const result: string[] = [];
  for (const line of left) {
    const count = rightCounts.get(line) ?? 0;
    if (count > 0) {
      rightCounts.set(line, count - 1);
      continue;
    }
    result.push(line);
    if (result.length >= limit) break;
  }
  return result;
}

export function buildDiffExcerpt(previous: string, current: string, limit = 40): DiffExcerpt {
  const oldLines = previous.split('\n');
  const newLines = current.split('\n');
  return {
    added: multisetDifference(newLines, oldLines, limit),
    removed: multisetDifference(oldLines, newLines, limit)
  };
}
