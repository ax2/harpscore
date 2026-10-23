import type { GraceNote, Measure, Mordent, Note, Score, ScoreSourceFormat, Technique } from '../types/score';
import { KEY_ROOTS, noteToMidi } from '../types/score';
import { isSupportedDuration, noteDuration, tieWarnings, techniqueWarnings } from './notation';
import { formatScoreLocation } from './scoreLocation';

type JsonObject = Record<string, unknown>;

export interface ImportResult {
  score?: Score;
  error?: string;
  warnings: string[];
  format?: 'score' | 'melody-dsl';
}

const TECHNIQUES = new Set<Technique>(['vibrato', 'bend-release', 'slap', 'gliss', 'trill']);
const SOURCE_FORMATS = new Set<ScoreSourceFormat>(['jianpu-text', 'jianpu-image', 'music-text', 'original']);
const TIME_SIGNATURE_RE = /^([1-9]\d?)\/(1|2|4|8|16)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeKey(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;
  const normalized = `${raw[0].toUpperCase()}${raw.slice(1)}`;
  return Object.prototype.hasOwnProperty.call(KEY_ROOTS, normalized) ? normalized : undefined;
}

function makeId(value: unknown, title: string): string {
  const base = nonEmptyString(value) ?? title;
  const slug = base
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return truncateId(slug, 64) || `score-${Date.now().toString(36)}`;
}

// Preserve Unicode code points and canonical separators across export/reimport.
function truncateId(id: string, length: number): string {
  return [...id].slice(0, length).join('').replace(/-+$/g, '');
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

function parseNoteObject(value: unknown, path: string, errors: string[], allowDecorations = true): Note | undefined {
  if (!isObject(value)) {
    errors.push(`${path} 必须是音符对象`);
    return undefined;
  }

  const degree = numberIn(value.degree, 0, 7);
  const beats = numberIn(value.beats, 0.0625, 32);
  if (degree === undefined || !Number.isInteger(degree)) errors.push(`${path}.degree 必须是 0–7 的整数`);
  if (beats === undefined) errors.push(`${path}.beats 必须是 0.0625–32 的有限正数`);
  if (degree === undefined || !Number.isInteger(degree) || beats === undefined) return undefined;

  const accidental = value.accidental === undefined ? 0 : numberIn(value.accidental, -1, 1);
  if (accidental === undefined || !Number.isInteger(accidental)) {
    errors.push(`${path}.accidental 只能是 -1、0 或 1`);
    return undefined;
  }
  const octave = value.octave === undefined ? 0 : numberIn(value.octave, -3, 3);
  if (octave === undefined || !Number.isInteger(octave)) {
    errors.push(`${path}.octave 必须是 -3–3 的整数`);
    return undefined;
  }
  if (value.dotted !== undefined && typeof value.dotted !== 'boolean') errors.push(`${path}.dotted 必须是布尔值`);
  if (value.tie !== undefined && typeof value.tie !== 'boolean') errors.push(`${path}.tie 必须是布尔值`);
  if (value.fermata !== undefined && typeof value.fermata !== 'boolean') errors.push(`${path}.fermata 必须是布尔值`);
  if (value.lyric !== undefined && typeof value.lyric !== 'string') errors.push(`${path}.lyric 必须是字符串`);

  let techniques: Technique[] | undefined;
  if (value.techniques !== undefined) {
    if (!Array.isArray(value.techniques) || value.techniques.some((item) => typeof item !== 'string' || !TECHNIQUES.has(item as Technique))) {
      errors.push(`${path}.techniques 含有不支持的技巧标记`);
    } else {
      techniques = [...new Set(value.techniques as Technique[])];
    }
  }

  let graceNotes: GraceNote[] | undefined;
  if (value.graceNotes !== undefined) {
    if (!allowDecorations || !Array.isArray(value.graceNotes) || value.graceNotes.length < 1 || value.graceNotes.length > 4) {
      errors.push(`${path}.graceNotes 必须是 1–4 个非嵌套的前倚音`);
    } else {
      graceNotes = value.graceNotes.flatMap((item, index) => {
        const grace = parseNoteObject(item, `${path}.graceNotes[${index}]`, errors, false);
        if (!grace || (grace.beats !== 0.25 && grace.beats !== 0.5)) {
          errors.push(`${path}.graceNotes[${index}].beats 仅支持八分或十六分倚音`);
          return [];
        }
        return [{ degree: grace.degree, accidental: grace.accidental, octave: grace.octave, beats: grace.beats }];
      });
    }
  }
  if (!allowDecorations && (degree === 0 || value.dotted !== undefined || value.tie !== undefined || value.fermata !== undefined || value.lyric !== undefined || value.techniques !== undefined)) {
    errors.push(`${path} 装饰辅助音不能是休止符，也不能带附点、延音、延长记号、歌词或技巧`);
  }

  let ornament: Mordent | undefined;
  if (value.ornament !== undefined) {
    if (!allowDecorations || !isObject(value.ornament) || !['upper-mordent', 'lower-mordent'].includes(String(value.ornament.kind)) || !isObject(value.ornament.auxiliary)) {
      errors.push(`${path}.ornament 必须是带 auxiliary 音高的 upper-mordent 或 lower-mordent`);
    } else {
      const auxiliary = value.ornament.auxiliary;
      if (['beats', 'dotted', 'tie', 'fermata', 'lyric', 'techniques', 'graceNotes', 'ornament'].some((field) => auxiliary[field] !== undefined)) {
        errors.push(`${path}.ornament.auxiliary 只能包含音高，不能带时值或装饰音属性`);
      }
      const pitch = parseNoteObject({ ...auxiliary, beats: 1 }, `${path}.ornament.auxiliary`, errors, false);
      if (pitch) ornament = { kind: value.ornament.kind as Mordent['kind'], auxiliary: { degree: pitch.degree, accidental: pitch.accidental, octave: pitch.octave } };
    }
  }

  return {
    degree,
    accidental: accidental as -1 | 0 | 1,
    octave,
    beats,
    ...(value.dotted === true ? { dotted: true } : {}),
    ...(value.tie === true ? { tie: true } : {}),
    ...(value.fermata === true ? { fermata: true } : {}),
    ...(typeof value.lyric === 'string' && value.lyric ? { lyric: value.lyric } : {}),
    ...(techniques?.length ? { techniques } : {}),
    ...(graceNotes?.length ? { graceNotes } : {}),
    ...(ornament ? { ornament } : {}),
  };
}

function parseLines(value: unknown, errors: string[]): Measure[][] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('lines 必须是非空的二维小节数组');
    return undefined;
  }

  const lines: Measure[][] = [];
  value.forEach((lineValue, lineIndex) => {
    if (!Array.isArray(lineValue) || lineValue.length === 0) {
      errors.push(`lines[${lineIndex}] 必须是非空小节数组`);
      return;
    }
    const line: Measure[] = [];
    lineValue.forEach((measureValue, measureIndex) => {
      const path = `lines[${lineIndex}][${measureIndex}]`;
      if (!isObject(measureValue) || !Array.isArray(measureValue.notes) || measureValue.notes.length === 0) {
        errors.push(`${path}.notes 必须是非空音符数组`);
        return;
      }
      const notes = measureValue.notes
        .map((note, noteIndex) => parseNoteObject(note, `${path}.notes[${noteIndex}]`, errors))
        .filter((note): note is Note => note !== undefined);
      if (notes.length !== measureValue.notes.length) return;
      if (measureValue.timeSignature !== undefined &&
        (typeof measureValue.timeSignature !== 'string' || !TIME_SIGNATURE_RE.test(measureValue.timeSignature))) {
        errors.push(`${path}.timeSignature 必须采用数字拍号（例如 3/4、6/8）`);
      }
      for (const flag of ['repeatBegin', 'repeatEnd', 'sectionEnd'] as const) {
        if (measureValue[flag] !== undefined && typeof measureValue[flag] !== 'boolean') {
          errors.push(`${path}.${flag} 必须是布尔值`);
        }
      }
      line.push({
        notes,
        ...(typeof measureValue.timeSignature === 'string' ? { timeSignature: measureValue.timeSignature } : {}),
        ...(measureValue.repeatBegin === true ? { repeatBegin: true } : {}),
        ...(measureValue.repeatEnd === true ? { repeatEnd: true } : {}),
        ...(measureValue.sectionEnd === true ? { sectionEnd: true } : {}),
      });
    });
    if (line.length === lineValue.length) lines.push(line);
  });
  return lines.length === value.length ? lines : undefined;
}

function parseDslToken(token: string, path: string, allowDecorations = true): Note {
  if (/^\[(U|L):/.test(token)) {
    const match = token.match(/^\[(U|L):([^\[\]]+)\](.+)$/);
    if (!allowDecorations || !match) throw new Error(`${path} 波音格式应为 [U:3']2'/ 或 [L:1]2`);
    const main = parseDslToken(match[3], path, false);
    const auxiliary = parseDslToken(match[2], `${path} 波音辅助音`, false);
    if (!auxiliary.degree || auxiliary.beats !== 1 || auxiliary.dotted || auxiliary.tie || auxiliary.fermata || auxiliary.lyric) {
      throw new Error(`${path} 波音辅助音只能指定音高`);
    }
    main.ornament = { kind: match[1] === 'U' ? 'upper-mordent' : 'lower-mordent', auxiliary: { degree: auxiliary.degree, accidental: auxiliary.accidental, octave: auxiliary.octave } };
    return main;
  }
  if (token.startsWith('{')) {
    const match = token.match(/^\{([^{}]+)\}(.+)$/);
    if (!allowDecorations || !match) throw new Error(`${path} 倚音格式应为 {6}1 或 {6;1'}5`);
    const parts = match[1].split(';');
    if (parts.length > 4 || parts.some((part) => !part)) throw new Error(`${path} 只支持 1–4 个前倚音`);
    const main = parseDslToken(match[2], path, false);
    main.graceNotes = parts.map((part, index) => {
      const grace = parseDslToken(part, `${path} 倚音 ${index + 1}`, false);
      if (!grace.degree || grace.dotted || grace.tie || grace.fermata || grace.lyric || ![0.25, 0.5, 1].includes(grace.beats)) {
        throw new Error(`${path} 倚音仅支持无附点的有声音高`);
      }
      return { degree: grace.degree, accidental: grace.accidental, octave: grace.octave, beats: grace.beats === 0.5 ? 0.5 : 0.25 };
    });
    return main;
  }
  if (/^-+$/.test(token)) throw new Error(`${path} 的延长符前没有音符`);
  const equals = token.indexOf('=');
  const lyric = equals >= 0 ? token.slice(equals + 1) : undefined;
  let notation = equals >= 0 ? token.slice(0, equals) : token;
  const tie = notation.endsWith('~');
  if (tie) notation = notation.slice(0, -1);
  const fermata = notation.endsWith('!');
  if (fermata) notation = notation.slice(0, -1);
  const match = notation.match(/^([#b]?)([0-7])([',]*)(\/{0,3})(\.)?$/);
  if (!match) throw new Error(`${path} 无法识别音符“${token}”`);

  const accidental = match[1] === '#' ? 1 : match[1] === 'b' ? -1 : 0;
  const octaveMarks = match[3];
  if (octaveMarks.includes("'") && octaveMarks.includes(',')) {
    throw new Error(`${path} 不能同时包含高、低八度标记`);
  }
  const octave = octaveMarks.startsWith("'") ? octaveMarks.length : octaveMarks.startsWith(',') ? -octaveMarks.length : 0;
  const beats = 2 ** -match[4].length;
  return {
    degree: Number(match[2]),
    accidental: accidental as -1 | 0 | 1,
    octave,
    beats,
    ...(match[5] ? { dotted: true } : {}),
    ...(tie ? { tie: true } : {}),
    ...(fermata ? { fermata: true } : {}),
    ...(lyric ? { lyric } : {}),
  };
}

export function parseMelodyDsl(melody: string): Measure[][] {
  const lines: Measure[][] = [];
  const sourceLines = melody.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim());
  if (sourceLines.length === 0) throw new Error('melody 不能为空');

  sourceLines.forEach((sourceLine, lineIndex) => {
    const parts = sourceLine.split(/(\|\||\|:|:\||\|)/).map((part) => part.trim()).filter(Boolean);
    const measures: Measure[] = [];
    let pendingRepeatBegin = false;
    for (const part of parts) {
      if (part === '|' || part === '||' || part === ':|' || part === '|:') {
        const previous = measures[measures.length - 1];
        if (part === '||' && previous) previous.sectionEnd = true;
        if (part === ':|' && previous) previous.repeatEnd = true;
        if (part === '|:') pendingRepeatBegin = true;
        continue;
      }
      const notes: Note[] = [];
      let timeSignature: string | undefined;
      for (const [tokenIndex, token] of part.split(/\s+/).entries()) {
        if (token.startsWith('[M:')) {
          const meter = token.match(/^\[M:([^\]]+)\]$/)?.[1];
          if (tokenIndex !== 0 || !meter || !TIME_SIGNATURE_RE.test(meter)) {
            throw new Error(`第 ${lineIndex + 1} 行的变拍记号必须位于小节开头，例如 [M:3/4]`);
          }
          timeSignature = meter;
          continue;
        }
        if (/^-+$/.test(token)) {
          const previous = notes[notes.length - 1];
          if (!previous) throw new Error(`第 ${lineIndex + 1} 行第 ${measures.length + 1} 小节的延长符前没有音符`);
          previous.beats += token.length;
          continue;
        }
        notes.push(parseDslToken(token, `第 ${lineIndex + 1} 行第 ${measures.length + 1} 小节第 ${tokenIndex + 1} 项`));
      }
      if (!notes.length) throw new Error(`第 ${lineIndex + 1} 行包含空小节`);
      measures.push({ notes, ...(timeSignature ? { timeSignature } : {}), ...(pendingRepeatBegin ? { repeatBegin: true } : {}) });
      pendingRepeatBegin = false;
    }
    if (!measures.length) throw new Error(`第 ${lineIndex + 1} 行没有小节`);
    lines.push(measures);
  });
  return lines;
}

function beatWarnings(score: Score): string[] {
  const match = score.timeSignature.match(TIME_SIGNATURE_RE);
  if (!match) return [];
  let expected = Number(match[1]) * 4 / Number(match[2]);
  let changedMeter = false;
  const mismatches: Array<{ lineIndex: number; measureIndex: number; actual: number; message: string }> = [];
  score.lines.forEach((line, lineIndex) => line.forEach((measure, measureIndex) => {
    if (measure.timeSignature) {
      const [numerator, denominator] = measure.timeSignature.split('/').map(Number);
      const nextExpected = numerator * 4 / denominator;
      changedMeter ||= measure.timeSignature !== score.timeSignature;
      expected = nextExpected;
    }
    const actual = measure.notes.reduce((sum, note) => sum + noteDuration(note), 0);
    if (Math.abs(actual - expected) > 0.0001) {
      mismatches.push({
        lineIndex,
        measureIndex,
        actual,
        message: `${formatScoreLocation(score, { lineIndex, measureIndex })}为 ${actual} 拍，拍号要求 ${expected} 拍`,
      });
    }
  }));
  const lastLineIndex = score.lines.length - 1;
  const lastMeasureIndex = score.lines[lastLineIndex].length - 1;
  const first = mismatches.find((item) => item.lineIndex === 0 && item.measureIndex === 0);
  const last = mismatches.find((item) => item.lineIndex === lastLineIndex && item.measureIndex === lastMeasureIndex);
  const hasComplementaryPickup = !changedMeter && first && last && first !== last && Math.abs(first.actual + last.actual - expected) < 0.0001;
  return mismatches
    .filter((item) => !hasComplementaryPickup || (item !== first && item !== last))
    .filter((item) => !(score.pickupBeats !== undefined && item === first
      && Math.abs(item.actual - score.pickupBeats) < 0.0001))
    .map((item) => item.message);
}

export function scoreFromObject(value: unknown): ImportResult {
  let root = value;
  if (Array.isArray(root)) {
    if (root.length !== 1) return { error: '一次只能导入一首曲谱；JSON 数组必须且只能包含 1 项', warnings: [] };
    [root] = root;
  }
  if (isObject(root) && isObject(root.score)) root = root.score;
  if (!isObject(root)) return { error: '曲谱必须是 JSON 对象', warnings: [] };

  const errors: string[] = [];
  const title = nonEmptyString(root.title);
  const key = normalizeKey(root.key);
  const harmonicaKey = normalizeKey(root.harmonicaKey ?? 'C');
  const timeSignature = nonEmptyString(root.timeSignature);
  if (!title) errors.push('title 必须是非空字符串');
  if (!key) errors.push('key 必须是支持的调名（例如 C、F#、Bb）');
  if (!harmonicaKey) errors.push('harmonicaKey 必须是支持的调名');
  if (!timeSignature || !TIME_SIGNATURE_RE.test(timeSignature)) errors.push('timeSignature 必须采用数字拍号（例如 4/4、6/8）');

  const difficultyValue = root.difficulty ?? 1;
  const difficulty = numberIn(difficultyValue, 1, 5);
  if (difficulty === undefined || !Number.isInteger(difficulty)) errors.push('difficulty 必须是 1–5 的整数');
  const tempo = root.tempo === undefined ? undefined : numberIn(root.tempo, 20, 400);
  if (root.tempo !== undefined && tempo === undefined) errors.push('tempo 必须是 20–400 的数字');
  const octaveShift = root.octaveShift === undefined ? undefined : numberIn(root.octaveShift, -3, 3);
  if (root.octaveShift !== undefined && (octaveShift === undefined || !Number.isInteger(octaveShift))) {
    errors.push('octaveShift 必须是 -3–3 的整数');
  }
  if (root.tags !== undefined && (!Array.isArray(root.tags) || root.tags.some((tag) => typeof tag !== 'string'))) {
    errors.push('tags 必须是字符串数组');
  }
  const order = root.order === undefined ? undefined : numberIn(root.order, 0, 10_000);
  if (root.order !== undefined && (order === undefined || !Number.isInteger(order))) errors.push('order 必须是非负整数');
  const sourceFormat = root.sourceFormat === undefined ? undefined : optionalString(root.sourceFormat);
  if (root.sourceFormat !== undefined && (!sourceFormat || !SOURCE_FORMATS.has(sourceFormat as ScoreSourceFormat))) {
    errors.push('sourceFormat 只能是 jianpu-text、jianpu-image、music-text 或 original');
  }
  const sourceUrl = optionalString(root.sourceUrl);
  if (root.sourceUrl !== undefined && !sourceUrl) errors.push('sourceUrl 必须是非空字符串');
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') errors.push('sourceUrl 必须是 HTTP(S) 链接');
    } catch {
      errors.push('sourceUrl 不是有效链接');
    }
  }
  const sourceCheckedAt = optionalString(root.sourceCheckedAt);
  if (root.sourceCheckedAt !== undefined && (!sourceCheckedAt || !ISO_DATE_RE.test(sourceCheckedAt)
    || !Number.isFinite(Date.parse(sourceCheckedAt))
    || new Date(sourceCheckedAt).toISOString().slice(0, 10) !== sourceCheckedAt)) {
    errors.push('sourceCheckedAt 必须采用 YYYY-MM-DD 格式');
  }

  let lines: Measure[][] | undefined;
  let format: ImportResult['format'] = 'score';
  if (typeof root.melody === 'string') {
    format = 'melody-dsl';
    try {
      lines = parseMelodyDsl(root.melody);
    } catch (error) {
      errors.push((error as Error).message);
    }
  } else {
    lines = parseLines(root.lines, errors);
  }

  let pickupBeats: number | undefined;
  if (root.pickupBeats !== undefined) {
    const first = lines?.[0]?.[0];
    const meter = first?.timeSignature ?? timeSignature;
    const parts = typeof meter === 'string' ? meter.match(TIME_SIGNATURE_RE) : null;
    const fullBar = parts ? Number(parts[1]) * 4 / Number(parts[2]) : 0;
    const value = root.pickupBeats;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= fullBar) {
      errors.push('pickupBeats 必须大于 0 且小于首小节拍号的完整时长（四分音符为一拍）');
    } else if (!first || (lines?.flat().length ?? 0) < 2
      || Math.abs(first.notes.reduce((sum, note) => sum + noteDuration(note), 0) - value) > 0.0001) {
      errors.push('pickupBeats 必须与首小节实际时长一致，且弱起后至少有一个小节');
    } else pickupBeats = value;
  }

  // DSL and full JSON share the same limits: accepted notation must survive export/reimport.
  lines?.forEach((line, li) => line.forEach((measure, mi) => measure.notes.forEach((note, ni) => {
    const path = `lines[${li}][${mi}].notes[${ni}]`;
    if (!isSupportedDuration(note)) errors.push(`${path}.beats 不支持该时值；请用三十二分、十六分、八分、四分音符或 2–4 拍长音及合法附点`);
    const octave = (note.octave ?? 0) + (note.degree === 0 ? 0 : (octaveShift ?? 0));
    if (Math.abs(octave) > 3) errors.push(`${path}.octave 合并移位后必须在 -3–3 范围内`);
    if (note.degree === 0 && (note.accidental || note.octave)) errors.push(`${path} 休止符不能带升降号或八度点`);
    if (note.degree === 0 && note.graceNotes?.length) errors.push(`${path} 休止符不能附带倚音`);
    note.graceNotes?.forEach((grace, gi) => {
      if (Math.abs((grace.octave ?? 0) + (octaveShift ?? 0)) > 3) errors.push(`${path}.graceNotes[${gi}].octave 合并移位后必须在 -3–3 范围内`);
    });
    if (note.ornament) {
      const auxiliary = note.ornament.auxiliary;
      if (!note.degree || note.graceNotes?.length || note.techniques?.length) errors.push(`${path} 波音必须附着于有声主音，暂不与其他装饰或技巧叠加`);
      if (Math.abs((auxiliary.octave ?? 0) + (octaveShift ?? 0)) > 3) errors.push(`${path}.ornament.auxiliary.octave 合并移位后必须在 -3–3 范围内`);
      const direction = note.ornament.kind === 'upper-mordent' ? 1 : -1;
      const steps = auxiliary.degree - note.degree + 7 * ((auxiliary.octave ?? 0) - (note.octave ?? 0));
      const interval = key ? noteToMidi(key, auxiliary)! - noteToMidi(key, note)! : 0;
      if (steps !== direction || interval * direction <= 0) errors.push(`${path}.ornament.auxiliary 必须是指定方向的相邻音级`);
    }
  })));

  if (errors.length || !title || !key || !harmonicaKey || !timeSignature || difficulty === undefined || !lines) {
    return { error: errors.slice(0, 8).join('；'), warnings: [], format };
  }

  // octaveShift 在生成阶段直接烘焙到每个音符的 octave 字段中。
  // 这样简谱八度点、孔位计算、音域分析三者完全一致，避免运行时只改一处导致显示与实际音高对不上。
  if (octaveShift) {
    for (const line of lines) {
      for (const measure of line) {
        for (const note of measure.notes) {
          if (note.degree !== 0) {
            note.octave = (note.octave ?? 0) + octaveShift;
          }
          for (const grace of note.graceNotes ?? []) grace.octave = (grace.octave ?? 0) + octaveShift;
          if (note.ornament) note.ornament.auxiliary.octave = (note.ornament.auxiliary.octave ?? 0) + octaveShift;
        }
      }
    }
  }

  const score: Score = {
    id: makeId(root.id, title),
    title,
    ...(optionalString(root.subtitle) ? { subtitle: optionalString(root.subtitle) } : {}),
    ...(optionalString(root.composer) ? { composer: optionalString(root.composer) } : {}),
    key,
    harmonicaKey,
    ...(optionalString(root.position) ? { position: optionalString(root.position) } : {}),
    timeSignature,
    ...(tempo !== undefined ? { tempo } : {}),
    ...(pickupBeats !== undefined ? { pickupBeats } : {}),
    difficulty: difficulty as Score['difficulty'],
    tags: Array.isArray(root.tags) ? [...new Set(root.tags.map(String).map((tag) => tag.trim()).filter(Boolean))] : [],
    ...(optionalString(root.source) ? { source: optionalString(root.source) } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceFormat && SOURCE_FORMATS.has(sourceFormat as ScoreSourceFormat)
      ? { sourceFormat: sourceFormat as ScoreSourceFormat }
      : {}),
    ...(sourceCheckedAt ? { sourceCheckedAt } : {}),
    builtin: false,
    ...(order !== undefined ? { order } : {}),
    ...(optionalString(root.notes) ? { notes: optionalString(root.notes) } : {}),
    ...(optionalString(root.updatedAt) ? { updatedAt: optionalString(root.updatedAt) } : {}),
    lines,
  };
  return { score, warnings: [...beatWarnings(score), ...tieWarnings(score), ...techniqueWarnings(score)], format };
}

export function importScoreJson(text: string): ImportResult {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return { error: '请粘贴曲谱 JSON 或选择 JSON 文件', warnings: [] };
  try {
    return scoreFromObject(JSON.parse(clean));
  } catch (error) {
    return { error: `JSON 解析失败：${(error as Error).message}`, warnings: [] };
  }
}

export function uniqueScoreId(score: Score, occupiedIds: Iterable<string>): Score {
  const occupied = new Set(occupiedIds);
  if (!occupied.has(score.id)) return score;
  let suffix = 2;
  const candidate = () => `${truncateId(score.id, 64 - String(suffix).length - 1)}-${suffix}`;
  while (occupied.has(candidate())) suffix += 1;
  return { ...score, id: candidate() };
}

/** A library backup is an array; validate every entry before any storage write. */
export function importLibraryBackup(text: string): { scores: Score[]; errors: string[]; warnings: string[] } {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '').trim()); }
  catch { return { scores: [], errors: ['备份不是有效的 JSON，请选择曲库备份文件'], warnings: [] }; }
  if (!Array.isArray(data)) return { scores: [], errors: ['曲库备份必须是 JSON 数组；单首曲谱请使用「导入曲谱」'], warnings: [] };
  const scores: Score[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  data.forEach((entry, index) => {
    const result = scoreFromObject(entry);
    if (!result.score) errors.push(`第 ${index + 1} 首：${result.error ?? '无法读取'}`);
    else {
      scores.push(result.score);
      warnings.push(...result.warnings.map(warning => `第 ${index + 1} 首《${result.score!.title}》：${warning}`));
    }
  });
  return { scores, errors, warnings };
}
