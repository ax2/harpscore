import type { Score } from '../types/score';

interface ScoreLocation {
  lineIndex: number;
  measureIndex: number;
  noteIndex?: number;
  graceIndex?: number;
  ornament?: boolean;
}

/** Authored bars, including the pickup; independent of responsive wrapping or repeats. */
export function formatScoreLocation(score: Score, location: ScoreLocation): string {
  const number = score.lines.slice(0, location.lineIndex)
    .reduce((total, line) => total + line.length, location.measureIndex + 1);
  let label = `第 ${number} 小节`;
  if (location.noteIndex !== undefined) label += `第 ${location.noteIndex + 1} 音`;
  if (location.graceIndex !== undefined) label += `的倚音 ${location.graceIndex + 1}`;
  else if (location.ornament) label += '的波音辅助音';
  return label;
}
