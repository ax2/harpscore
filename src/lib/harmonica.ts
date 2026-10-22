/**
 * 十孔布鲁斯口琴（Richter 音阶，C 调）音高引擎
 * 负责：MIDI 音高 ↔ 孔位/吹吸/压音 映射、曲谱可吹性分析
 */
import type { Note, Score, Breath } from '../types/score';
import { KEY_ROOTS, noteToMidi } from '../types/score';
import { notesIncludingGrace } from './notation';

/** 孔位演奏方式 */
export interface HoleOption {
  hole: number;
  breath: Breath;
  /** 压音级别 0-3 */
  bend: 0 | 1 | 2 | 3;
  /** 超吹/超吸 */
  overblow: boolean;
  /** 演奏难度权重：0 自然音，1-3 压音，5 超吹 */
  difficulty: number;
}

/**
 * C 调十孔口琴完整音高表（MIDI → 演奏方式列表）
 * 吹音:  1:C4 2:E4 3:G4 4:C5 5:E5 6:G5 7:C6 8:E6 9:G6 10:C7
 * 吸音:  1:D4 2:G4 3:B4 4:D5 5:F5 6:A5 7:B5 8:D6 9:F6 10:A6
 * 吸压音: 1':Db4 2':F#4 2'':F4 3':Bb4 3'':A4 3''':Ab4 4':Db5 6':Ab5
 * 吹压音: 8':Eb6 9':F#6 10':B6 10'':Bb6
 * 5 吸/7 吹只能微降，不能压到对侧簧片的完整半音。
 * 超吹: 1°:Eb4 4°:Eb5 5°:F#5 6°:Bb5；超吸: 7°:Db6 9°:Ab6 10°:Db7
 * 依据 HOHNER Standard Richter 调音表与 Steve Baker 的 Bending & Overblowing 说明。
 */
function buildTable(): Map<number, HoleOption[]> {
  const t = new Map<number, HoleOption[]>();
  const add = (midi: number, o: HoleOption) => {
    const arr = t.get(midi) ?? [];
    arr.push(o);
    t.set(midi, arr);
  };
  const nat = (hole: number, breath: Breath): HoleOption => ({ hole, breath, bend: 0, overblow: false, difficulty: 0 });

  // 自然吹音
  const blows: [number, number][] = [[1, 60], [2, 64], [3, 67], [4, 72], [5, 76], [6, 79], [7, 84], [8, 88], [9, 91], [10, 96]];
  for (const [h, m] of blows) add(m, nat(h, 'blow'));
  // 自然吸音
  const draws: [number, number][] = [[1, 62], [2, 67], [3, 71], [4, 74], [5, 77], [6, 81], [7, 83], [8, 86], [9, 89], [10, 93]];
  for (const [h, m] of draws) add(m, nat(h, 'draw'));
  // 吸压音（1-6 孔）
  const drawBends: [number, number, 1 | 2 | 3][] = [
    [1, 61, 1],           // 1': Db4
    [2, 66, 1], [2, 65, 2], // 2': F#4  2'': F4
    [3, 70, 1], [3, 69, 2], [3, 68, 3], // 3': Bb4 3'': A4 3''': Ab4
    [4, 73, 1],           // 4': Db5
    [6, 80, 1],           // 6': Ab5
  ];
  for (const [h, m, b] of drawBends) {
    add(m, { hole: h, breath: 'draw', bend: b, overblow: false, difficulty: b });
  }
  // 吹压音（7-10 孔）
  const blowBends: [number, number, 1 | 2][] = [
    [8, 87, 1],   // 8': Eb6
    [9, 90, 1],   // 9': F#6
    [10, 95, 1],  // 10': B6
    [10, 94, 2],  // 10'': Bb6
  ];
  for (const [h, m, b] of blowBends) {
    add(m, { hole: h, breath: 'blow', bend: b, overblow: false, difficulty: b + 1 });
  }
  // 超吹（1/4/5/6 孔，高级技巧）
  const overblows: [number, number][] = [[1, 63], [4, 75], [5, 78], [6, 82]];
  for (const [h, m] of overblows) {
    add(m, { hole: h, breath: 'blow', bend: 0, overblow: true, difficulty: 5 });
  }
  for (const [h, m] of [[7, 85], [9, 92], [10, 97]]) {
    add(m, { hole: h, breath: 'draw', bend: 0, overblow: true, difficulty: 5 });
  }
  // 每个音按难度排序，同级优先吹音
  for (const arr of t.values()) {
    arr.sort((a, b) => a.difficulty - b.difficulty || Number(a.breath === 'draw') - Number(b.breath === 'draw'));
  }
  return t;
}

const TABLE = buildTable();

/** 最低 / 最高可奏 MIDI（不含超吹） */
export const RANGE_MIN = 60; // C4
export const RANGE_MAX = 96; // C7

/** 查找某 MIDI 音高的最佳演奏方式；不可奏返回 null */
export function harmonicaRoot(key: string): number | null {
  const root = KEY_ROOTS[key];
  if (root === undefined) return null;
  // Standard Richter G–B instruments start below C4. Low/High models are separate tunings.
  return root >= 67 ? root - 12 : root;
}

export function findHole(midi: number, allowOverblow = false, harmonicaKey = 'C'): HoleOption | null {
  const root = harmonicaRoot(harmonicaKey);
  if (root === null) return null;
  const opts = TABLE.get(midi - (root - 60));
  if (!opts) return null;
  const filtered = allowOverblow ? opts : opts.filter((o) => !o.overblow);
  return filtered[0] ?? null;
}

/** 曲谱可吹性分析结果 */
export interface ScoreIssue {
  lineIndex: number;
  measureIndex: number;
  noteIndex: number;
  graceIndex?: number;
  midi: number | null;
  reason: string;
  severity: 'error' | 'warning';
}

export interface ScoreAnalysis {
  playable: boolean;
  issues: ScoreIssue[];
  /** 需要的压音音符数 */
  bendNotes: number;
  /** 需要的超吹音符数 */
  overblowNotes: number;
  /** 总音符数（不含休止符） */
  totalNotes: number;
  /** 上述总音符中包含的前倚音数 */
  graceNotes: number;
  /** 最低/最高 MIDI */
  minMidi: number | null;
  maxMidi: number | null;
}

/** 为曲谱所有音符自动推算孔位标记，并分析可吹性 */
export function analyzeScore(score: Score, allowOverblow = false): ScoreAnalysis {
  const issues: ScoreIssue[] = [];
  let bendNotes = 0, overblowNotes = 0, totalNotes = 0, graceNotes = 0;
  let minMidi: number | null = null, maxMidi: number | null = null;
  const root = harmonicaRoot(score.harmonicaKey);

  score.lines.forEach((line, li) => {
    line.forEach((measure, mi) => {
      measure.notes.forEach((main, ni) => notesIncludingGrace(main).forEach((note, index) => {
        const isGrace = index < (main.graceNotes?.length ?? 0);
        const location = { lineIndex: li, measureIndex: mi, noteIndex: ni, ...(isGrace ? { graceIndex: index } : {}) };
        // 清除导入文件或上一次分析留下的派生孔位，避免不可奏音显示陈旧标记。
        note.hole = null;
        note.breath = null;
        note.bend = 0;
        note.overblow = false;
        if (note.degree === 0) return;
        totalNotes++;
        if (isGrace) graceNotes++;
        const midi = noteToMidi(score.key, note, score.octaveShift ?? 0);
        if (midi === null) {
          issues.push({ ...location, midi, reason: '无法解析音高', severity: 'error' });
          return;
        }
        if (minMidi === null || midi < minMidi) minMidi = midi;
        if (maxMidi === null || midi > maxMidi) maxMidi = midi;
        const opt = findHole(midi, allowOverblow, score.harmonicaKey);
        if (!opt) {
          const why = root === null ? '不支持的口琴调性'
            : midi < root ? `低于口琴最低音 (${midiToName(root)})`
            : midi > root + 36 + (allowOverblow ? 1 : 0) ? `高于当前模式最高音 (${midiToName(root + 36 + (allowOverblow ? 1 : 0))})`
            : '该音需要超吹/超吸等高级技巧';
          issues.push({ ...location, midi, reason: why, severity: 'error' });
          return;
        }
        // 自动填充演奏标记
        note.hole = opt.hole;
        note.breath = opt.breath;
        note.bend = opt.bend;
        note.overblow = opt.overblow;
        if (opt.overblow) {
          overblowNotes++;
          issues.push({ ...location, midi, reason: `${opt.hole} 孔${opt.breath === 'blow' ? '超吹' : '超吸'}（高级技巧）`, severity: 'warning' });
        } else if (opt.bend > 0) {
          bendNotes++;
          issues.push({ ...location, midi, reason: `${opt.hole} 孔${opt.breath === 'blow' ? '吹' : '吸'}${"'".repeat(opt.bend)} ${opt.bend} 级压音`, severity: 'warning' });
        }
      }));
    });
  });

  return {
    playable: issues.every((i) => i.severity !== 'error'),
    issues, bendNotes, overblowNotes, totalNotes, graceNotes, minMidi, maxMidi,
  };
}

/** MIDI → 音名（如 C#5） */
export function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** 口琴孔位标记文本，如 +4 / -3'' / +1° */
export function holeLabel(note: Note): string {
  if (note.degree === 0 || note.hole == null || !note.breath) return '';
  const sign = note.breath === 'blow' ? '+' : '-';
  const bend = note.bend ? "'".repeat(note.bend) : '';
  const ob = note.overblow ? '°' : '';
  return `${sign}${note.hole}${bend}${ob}`;
}
