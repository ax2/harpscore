import type { Note, PitchNote, Score } from '../types/score';
import { noteToMidi } from '../types/score';

export function notesForAnalysis(note: Note): PitchNote[] {
  return [...(note.graceNotes ?? []), note, ...(note.ornament ? [note.ornament.auxiliary] : [])];
}

/** All durations use a quarter note as one beat, including compound meters. */
export function noteDuration(note: Note): number {
  return note.beats * (note.dotted ? 1.5 : 1);
}

export function isSupportedDuration(note: Pick<Note, 'beats' | 'dotted'>): boolean {
  return [0.25, 0.5, 1, 2, 3, 4].includes(note.beats)
    && !(note.beats === 3 && note.dotted);
}

export function tieWarnings(score: Score): string[] {
  const notes = score.lines.flatMap((line, li) => line.flatMap((measure, mi) =>
    measure.notes.map((note, ni) => ({ note, li, mi, ni }))));
  return notes.flatMap(({ note, li, mi, ni }, index) => {
    if (!note.tie) return [];
    const next = notes[index + 1]?.note;
    if (next?.graceNotes?.length) return [`第 ${li + 1} 行第 ${mi + 1} 小节第 ${ni + 1} 音的延音线暂不支持跨过前倚音，请分开记谱`];
    if (next?.ornament) return [`第 ${li + 1} 行第 ${mi + 1} 小节第 ${ni + 1} 音的延音线暂不支持跨过波音，请分开记谱`];
    if (note.degree !== 0 && next && next.degree !== 0
      && noteToMidi(score.key, note) === noteToMidi(score.key, next)) return [];
    return [`第 ${li + 1} 行第 ${mi + 1} 小节第 ${ni + 1} 音的延音线必须连接后续同音高音符`];
  });
}
