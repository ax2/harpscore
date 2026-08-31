import type { Measure, Note, Score, ScoreSourceFormat, Technique } from '../types/score';
import { KEY_ROOTS } from '../types/score';

type JsonObject = Record<string, unknown>;

export interface ImportResult {
  score?: Score;
  error?: string;
  warnings: string[];
  format?: 'score' | 'melody-dsl';
}

const TECHNIQUES = new Set<Technique>(['vibrato', 'bend-release', 'slap', 'gliss', 'trill']);
const SOURCE_FORMATS = new Set<ScoreSourceFormat>(['jianpu-text', 'jianpu-image', 'original']);
const TIME_SIGNATURE_RE = /^(\d{1,2})\/(1|2|4|8|16)$/;
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
  return normalized in KEY_ROOTS ? normalized : undefined;
}

function makeId(value: unknown, title: string): string {
  const base = nonEmptyString(value) ?? title;
  const slug = base
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `score-${Date.now().toString(36)}`;
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

function parseNoteObject(value: unknown, path: string, errors: string[]): Note | undefined {
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
  if (value.lyric !== undefined && typeof value.lyric !== 'string') errors.push(`${path}.lyric 必须是字符串`);

  let techniques: Technique[] | undefined;
  if (value.techniques !== undefined) {
    if (!Array.isArray(value.techniques) || value.techniques.some((item) => typeof item !== 'string' || !TECHNIQUES.has(item as Technique))) {
      errors.push(`${path}.techniques 含有不支持的技巧标记`);
    } else {
      techniques = [...new Set(value.techniques as Technique[])];
    }
  }

  return {
    degree,
    accidental: accidental as -1 | 0 | 1,
    octave,
    beats,
    ...(value.dotted === true ? { dotted: true } : {}),
    ...(value.tie === true ? { tie: true } : {}),
    ...(typeof value.lyric === 'string' && value.lyric ? { lyric: value.lyric } : {}),
    ...(techniques?.length ? { techniques } : {}),
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
      for (const flag of ['repeatBegin', 'repeatEnd', 'sectionEnd'] as const) {
        if (measureValue[flag] !== undefined && typeof measureValue[flag] !== 'boolean') {
          errors.push(`${path}.${flag} 必须是布尔值`);
        }
      }
      line.push({
        notes,
        ...(measureValue.repeatBegin === true ? { repeatBegin: true } : {}),
        ...(measureValue.repeatEnd === true ? { repeatEnd: true } : {}),
        ...(measureValue.sectionEnd === true ? { sectionEnd: true } : {}),
      });
    });
    if (line.length === lineValue.length) lines.push(line);
  });
  return lines.length === value.length ? lines : undefined;
}

function parseDslToken(token: string, path: string): Note {
  if (/^-+$/.test(token)) throw new Error(`${path} 的延长符前没有音符`);
  const equals = token.indexOf('=');
  const lyric = equals >= 0 ? token.slice(equals + 1) : undefined;
  let notation = equals >= 0 ? token.slice(0, equals) : token;
  const tie = notation.endsWith('~');
  if (tie) notation = notation.slice(0, -1);
  const match = notation.match(/^([#b]?)([0-7])([',]*)(\/{0,2})(\.)?$/);
  if (!match) throw new Error(`${path} 无法识别音符“${token}”`);

  const accidental = match[1] === '#' ? 1 : match[1] === 'b' ? -1 : 0;
  const octaveMarks = match[3];
  if (octaveMarks.includes("'") && octaveMarks.includes(',')) {
    throw new Error(`${path} 不能同时包含高、低八度标记`);
  }
  const octave = octaveMarks.startsWith("'") ? octaveMarks.length : octaveMarks.startsWith(',') ? -octaveMarks.length : 0;
  const beats = match[4].length === 2 ? 0.25 : match[4].length === 1 ? 0.5 : 1;
  return {
    degree: Number(match[2]),
    accidental: accidental as -1 | 0 | 1,
    octave,
    beats,
    ...(match[5] ? { dotted: true } : {}),
    ...(tie ? { tie: true } : {}),
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
      for (const [tokenIndex, token] of part.split(/\s+/).entries()) {
        if (/^-+$/.test(token)) {
          const previous = notes[notes.length - 1];
          if (!previous) throw new Error(`第 ${lineIndex + 1} 行第 ${measures.length + 1} 小节的延长符前没有音符`);
          previous.beats += token.length;
          continue;
        }
        notes.push(parseDslToken(token, `第 ${lineIndex + 1} 行第 ${measures.length + 1} 小节第 ${tokenIndex + 1} 项`));
      }
      if (!notes.length) throw new Error(`第 ${lineIndex + 1} 行包含空小节`);
      measures.push({ notes, ...(pendingRepeatBegin ? { repeatBegin: true } : {}) });
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
  const expected = Number(match[1]) * 4 / Number(match[2]);
  const mismatches: Array<{ lineIndex: number; measureIndex: number; actual: number; message: string }> = [];
  score.lines.forEach((line, lineIndex) => line.forEach((measure, measureIndex) => {
    const actual = measure.notes.reduce((sum, note) => sum + note.beats * (note.dotted ? 1.5 : 1), 0);
    if (Math.abs(actual - expected) > 0.0001) {
      mismatches.push({
        lineIndex,
        measureIndex,
        actual,
        message: `第 ${lineIndex + 1} 行第 ${measureIndex + 1} 小节为 ${actual} 拍，拍号要求 ${expected} 拍`,
      });
    }
  }));
  const lastLineIndex = score.lines.length - 1;
  const lastMeasureIndex = score.lines[lastLineIndex].length - 1;
  const first = mismatches.find((item) => item.lineIndex === 0 && item.measureIndex === 0);
  const last = mismatches.find((item) => item.lineIndex === lastLineIndex && item.measureIndex === lastMeasureIndex);
  const hasComplementaryPickup = first && last && Math.abs(first.actual + last.actual - expected) < 0.0001;
  return mismatches
    .filter((item) => !hasComplementaryPickup || (item !== first && item !== last))
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
  if (sourceFormat !== undefined && !SOURCE_FORMATS.has(sourceFormat as ScoreSourceFormat)) {
    errors.push('sourceFormat 只能是 jianpu-text、jianpu-image 或 original');
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
  if (root.sourceCheckedAt !== undefined && (!sourceCheckedAt || !ISO_DATE_RE.test(sourceCheckedAt))) {
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
    lines,
  };
  return { score, warnings: beatWarnings(score), format };
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
  while (occupied.has(`${score.id}-${suffix}`)) suffix += 1;
  return { ...score, id: `${score.id}-${suffix}` };
}
