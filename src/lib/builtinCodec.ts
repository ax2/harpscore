import type { Measure, Note, Score } from '../types/score';

type PackedMeasure = Omit<Measure, 'notes'> & { notes: number[] };
type PackedScore = Omit<Score, 'lines'> & { lines: PackedMeasure[][] };

/** Build-only transport format. Public score files and exports still use Score. */
export interface PackedBuiltinLibrary {
  version: 1;
  notes: Note[];
  scores: PackedScore[];
}

export function packBuiltinScores(scores: Score[]): PackedBuiltinLibrary {
  const notes: Note[] = [];
  const indexes = new Map<string, number>();
  const packedScores = scores.map(score => {
    const { lines, ...metadata } = structuredClone(score);
    return {
      ...metadata,
      lines: lines.map(line => line.map(({ notes: measureNotes, ...measure }) => ({
        ...measure,
        notes: measureNotes.map(note => {
          const key = JSON.stringify(note);
          let index = indexes.get(key);
          if (index === undefined) {
            index = notes.length;
            indexes.set(key, index);
            notes.push(note);
          }
          return index;
        }),
      }))),
    };
  });
  return { version: 1, notes, scores: packedScores };
}

export function unpackBuiltinScores(packed: PackedBuiltinLibrary): Score[] {
  if (packed.version !== 1) throw new Error('不支持的内置曲库数据版本');
  return packed.scores.map(score => {
    const { lines, ...metadata } = structuredClone(score);
    return {
      ...metadata,
      lines: lines.map(line => line.map(({ notes: indexes, ...measure }) => ({
        ...measure,
        notes: indexes.map(index => {
          if (!Number.isInteger(index) || index < 0 || index >= packed.notes.length) {
            throw new Error(`内置曲库 ${metadata.id} 的音符索引无效：${index}`);
          }
          // Analysis fills fingering fields in place. Every occurrence, including
          // its grace/ornament objects, must be independent of the dictionary.
          return structuredClone(packed.notes[index]);
        }),
      }))),
    };
  });
}
