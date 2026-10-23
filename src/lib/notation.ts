import type { Note, PitchNote, Score, Technique } from '../types/score';
import { noteToMidi } from '../types/score';
import { formatScoreLocation } from './scoreLocation';

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  vibrato: '~ 振音', 'bend-release': '压音释放', slap: '舌拍', gliss: '滑音', trill: '颤音',
};

/** These legacy flags do not specify all pitches involved in the gesture. */
export function techniqueWarnings(score: Score): string[] {
  return score.lines.flatMap((line, li) => line.flatMap((measure, mi) => measure.notes.flatMap((note, ni) => {
    const location = formatScoreLocation(score, { lineIndex: li, measureIndex: mi, noteIndex: ni });
    if (!note.techniques?.length) return [];
    if (note.degree === 0) return [`${location}为休止符，不应带演奏技巧；请核对原谱`];
    return note.techniques.flatMap(technique => {
      if (technique === 'trill') return [`${location}的颤音未指定交替音，只显示文字提示；交替音未作孔位校验`];
      if (technique === 'gliss') return [`${location}的滑音未指定起止及过程音，只显示文字提示；过程音未作孔位校验`];
      if (technique === 'bend-release') return [`${location}的压音释放未指定完整音高变化，只显示文字提示；过程音未作孔位校验`];
      if (technique === 'slap') return [`${location}的舌拍未指定和声音；孔位校验只包含已写出的主音`];
      return [];
    });
  })));
}

export function notesForAnalysis(note: Note): PitchNote[] {
  return [...(note.graceNotes ?? []), note, ...(note.ornament ? [note.ornament.auxiliary] : [])];
}

/** All durations use a quarter note as one beat, including compound meters. */
export function noteDuration(note: Note): number {
  return note.beats * (note.dotted ? 1.5 : 1);
}

export function isSupportedDuration(note: Pick<Note, 'beats' | 'dotted'>): boolean {
  return [0.125, 0.25, 0.5, 1, 2, 3, 4].includes(note.beats)
    && !(note.beats === 3 && note.dotted);
}

export function tieWarnings(score: Score): string[] {
  const notes = score.lines.flatMap((line, li) => line.flatMap((measure, mi) =>
    measure.notes.map((note, ni) => ({ note, li, mi, ni }))));
  return notes.flatMap(({ note, li, mi, ni }, index) => {
    if (!note.tie) return [];
    const next = notes[index + 1]?.note;
    const location = formatScoreLocation(score, { lineIndex: li, measureIndex: mi, noteIndex: ni });
    if (next?.graceNotes?.length) return [`${location}的延音线暂不支持跨过前倚音，请分开记谱`];
    if (next?.ornament) return [`${location}的延音线暂不支持跨过波音，请分开记谱`];
    if (note.degree !== 0 && next && next.degree !== 0
      && noteToMidi(score.key, note) === noteToMidi(score.key, next)) return [];
    return [`${location}的延音线必须连接后续同音高音符`];
  });
}
