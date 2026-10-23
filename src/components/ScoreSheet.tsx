/**
 * ScoreSheet - 专业乐谱 SVG 渲染
 * 上行：简谱（数字 + 八度点 + 升降号 + 附点 + 节奏下划线 + 延音线）
 * 下行：口琴演奏标记（吹吸 + 孔号 + 压音符号 + 技巧）
 * 小节线 / 反复记号 / 双纵线贯穿两行
 */
import React, { useEffect, useRef, useState } from 'react';
import type { GraceNote, Measure, Note, PitchNote, Score } from '../types/score';
import { noteDuration, TECHNIQUE_LABELS } from '../lib/notation';
import { holeLabel } from '../lib/harmonica';

/* ---------- 排版常量 ---------- */
export const LAYOUT = {
  pageWidth: 1080,
  padX: 56,
  padTop: 40,
  headerHeight: 170,
  lineGap: 46,
  // 行内纵向位置（相对行顶）
  highDotY: 8,
  numberY: 34,
  lowDotY: 43,
  beam1Y: 65,
  beam2Y: 71,
  tabY: 98,
  lyricY: 122,
  lineBaseHeight: 110, // 不含歌词
  lyricHeight: 22,
  barTop: 10,
  barBottom: 102,
};

const INK = '#1b1b1b';
const BLOW_COLOR = '#c0392b'; // 吹气 - 暖红
const DRAW_COLOR = '#1f618d'; // 吸气 - 深蓝
const PAPER = '#fffdf7';
const FAINT = '#8a8578';

const NUM_FONT = "Verdana, 'Segoe UI', Arial, sans-serif";
const TITLE_FONT = "Georgia, 'Times New Roman', 'SimSun', serif";

/* ---------- 布局计算 ---------- */
interface PlacedNote {
  note: Note;
  x: number; // 中心 x
  w: number;
  showNatural: boolean;
  auxiliaryNatural: boolean;
  graceNotes: { note: GraceNote; x: number; showNatural: boolean }[];
}

interface PlacedMeasure {
  measure: Measure;
  number: number;
  x: number; // 起始 x（含小节线后）
  w: number;
  notes: PlacedNote[];
  continuesFromPrevious: boolean;
  continuesOnNext: boolean;
}

interface MeasureFragment {
  measure: Measure;
  original: Measure;
  number: number;
  continuesFromPrevious: boolean;
  continuesOnNext: boolean;
}

interface PlacedLine {
  measures: PlacedMeasure[];
  y: number;
  numberY: number;
  height: number;
  hasLyric: boolean;
  hasOrnament: boolean;
  techniqueRows: number;
  articulationOffset: number;
}

function mainNoteWidth(n: Note): number {
  const dur = noteDuration(n);
  if (dur >= 2) return 38 * dur;
  return Math.max(n.ornament ? 64 : n.techniques?.length ? 56 : 38, 30 + dur * 16);
}

function graceWidth(n: Note): number {
  return n.graceNotes?.length ? n.graceNotes.length * 28 + 10 : 0;
}

function noteWidth(n: Note): number {
  return mainNoteWidth(n) + graceWidth(n);
}

function symbolCount(n: Note): number {
  return noteDuration(n) >= 2 ? noteDuration(n) : 1;
}

function beamLevel(n: Note): number {
  if (n.beats <= 0.125) return 3;
  if (n.beats <= 0.25) return 2;
  if (n.beats <= 0.5) return 1;
  return 0;
}

function meterWidth(m: Measure): number {
  return m.timeSignature ? 42 : 0;
}

export function layoutScore(score: Score, pageWidth = LAYOUT.pageWidth, showMeasureNumbers = false): { lines: PlacedLine[]; width: number; height: number } {
  const W = pageWidth;
  const compact = W < 700;
  const avail = W - LAYOUT.padX * 2;
  const lines: PlacedLine[] = [];
  let y = LAYOUT.padTop + LAYOUT.headerHeight + (compact ? 28 : 0);

  // Preserve authored line breaks but wrap dense rows instead of clipping the SVG.
  const rows: MeasureFragment[][] = [];
  let measureNumber = 0;
  score.lines.forEach((rawLine) => {
    let row: MeasureFragment[] = [];
    let rowWidth = 0;
    rawLine.forEach((measure) => {
      measureNumber++;
      const target = avail - (rows.length === 0 ? (compact ? 0 : 64) : 0);
      // Split an oversized bar at a beat boundary where possible. The fragments
      // remain one musical measure; dashed edges and “续” distinguish a wrap
      // from a barline. Never squeeze dense fingerings into overlapping glyphs.
      let start = 0;
      let elapsed = 0;
      const fragments: MeasureFragment[] = [];
      while (start < measure.notes.length) {
        let end = start;
        const beatEnds: { end: number; width: number }[] = [];
        let used = 16 + (start === 0 ? meterWidth(measure) : 0);
        let endBeat = elapsed;
        while (end < measure.notes.length) {
          const nextWidth = noteWidth(measure.notes[end]);
          if (end > start && used + nextWidth > target / 0.85) break;
          used += nextWidth;
          endBeat += noteDuration(measure.notes[end]);
          end++;
          if (Math.abs(endBeat - Math.round(endBeat)) < 1e-8) beatEnds.push({ end, width: used });
        }
        if (end < measure.notes.length && beatEnds.length) {
          const remainingWidth = measure.notes.slice(start).reduce((sum, n) => sum + noteWidth(n), 16);
          const idealWidth = remainingWidth / Math.ceil(remainingWidth / (target / 0.85));
          end = beatEnds.reduce((best, candidate) =>
            Math.abs(candidate.width - idealWidth) < Math.abs(best.width - idealWidth) ? candidate : best).end;
        }
        const notes = measure.notes.slice(start, end);
        fragments.push({
          original: measure,
          number: measureNumber,
          measure: { ...measure, notes, timeSignature: start === 0 ? measure.timeSignature : undefined,
            repeatBegin: start === 0 && measure.repeatBegin,
            repeatEnd: end === measure.notes.length && measure.repeatEnd,
            sectionEnd: end === measure.notes.length && measure.sectionEnd },
          continuesFromPrevious: start > 0, continuesOnNext: end < measure.notes.length,
        });
        elapsed += notes.reduce((sum, n) => sum + noteDuration(n), 0);
        start = end;
      }
      fragments.forEach((fragment) => {
        const width = fragment.measure.notes.reduce((sum, n) => sum + noteWidth(n), 0) + 16 + meterWidth(fragment.measure);
        if (row.length && (fragment.continuesFromPrevious || rowWidth + width > target / 0.85)) {
          rows.push(row);
          row = [];
          rowWidth = 0;
        }
        row.push(fragment);
        rowWidth += width;
      });
    });
    if (row.length) rows.push(row);
  });
  const accidentalStates = new Map<Measure, Map<string, number>>();
  rows.forEach((rawLine, li) => {
    const firstLineIndent = li === 0 && !compact ? 64 : 0;
    const hasOrnament = rawLine.some(({ measure }) => measure.notes.some((n) => n.ornament));
    if (hasOrnament) y += 18;
    const hasFermata = rawLine.some(({ measure }) => measure.notes.some((n) => n.fermata));
    if (hasFermata) y += 18;
    const hasGrace = rawLine.some(({ measure }) => measure.notes.some((n) => n.graceNotes?.length));
    const previousLine = lines[lines.length - 1];
    const previousBar = previousLine?.measures[previousLine.measures.length - 1];
    const hasTie = rawLine.some(({ measure }) => measure.notes.some((n) => n.tie))
      || previousBar?.notes[previousBar.notes.length - 1]?.note.tie;
    const hasArticulation = rawLine.some(({ measure }) => measure.notes.some(n => n.articulation));
    // A common band within each row also clears incoming ties on marked notes.
    const articulationOffset = hasFermata ? 72 : hasOrnament ? 64 : hasGrace || hasTie ? 44 : 20;
    if (hasArticulation) y += 24;
    // Separate the optional labels from fermatas, ornaments and grace/tie arcs.
    const numberOffset = hasArticulation ? articulationOffset + 16 : hasFermata ? 66 : hasOrnament ? 54 : hasGrace || hasTie ? 40 : 18;
    if (showMeasureNumbers) y += numberOffset + 8;
    // 自然宽度
    const mWidths = rawLine.map(({ measure: m }) => {
      const nw = m.notes.reduce((s, n) => s + noteWidth(n), 0);
      return nw + 16 + meterWidth(m); // 小节内边距及变拍记号
    });
    const natural = mWidths.reduce((a, b) => a + b, 0);
    const target = avail - firstLineIndent;
    const scale = Math.min(target / natural, 1.9);

    let x = LAYOUT.padX + firstLineIndent;
    const measures: PlacedMeasure[] = rawLine.map((fragment, mi) => {
      const m = fragment.measure;
      const mw = mWidths[mi] * scale;
      let nx = x + (8 + meterWidth(m)) * scale;
      const accidentals = accidentalStates.get(fragment.original) ?? new Map<string, number>();
      accidentalStates.set(fragment.original, accidentals);
      const needsNatural = (n: PitchNote) => {
        const pitch = `${n.degree}:${n.octave ?? 0}`;
        const accidental = n.accidental ?? 0;
        const natural = n.degree !== 0 && accidental === 0 && !!accidentals.get(pitch);
        if (n.degree !== 0) accidentals.set(pitch, accidental);
        return natural;
      };
      const notes: PlacedNote[] = m.notes.map((n) => {
        const graceNotes = (n.graceNotes ?? []).map((grace, index) => ({
          note: grace, x: nx + (index * 28 + 14) * scale, showNatural: needsNatural(grace),
        }));
        nx += graceWidth(n) * scale;
        const w = mainNoteWidth(n) * scale;
        const cx = nx + w / (2 * symbolCount(n));
        nx += w;
        // Imported pitches are explicit per note. Cancel a prior alteration in the
        // same measure so the printed notation agrees with those absolute pitches.
        const showNatural = needsNatural(n);
        const auxiliaryNatural = n.ornament ? needsNatural(n.ornament.auxiliary) : false;
        return { note: n, x: cx, w, showNatural, auxiliaryNatural, graceNotes };
      });
      const pm = { measure: m, number: fragment.number, x, w: mw, notes,
        continuesFromPrevious: fragment.continuesFromPrevious, continuesOnNext: fragment.continuesOnNext };
      x += mw;
      return pm;
    });

    const hasLyric = rawLine.some(({ measure }) => measure.notes.some((n) => n.lyric));
    const techniqueRows = Math.max(0, ...rawLine.flatMap(({ measure }) => measure.notes.map(n => n.techniques?.length ?? 0)));
    const height = LAYOUT.lineBaseHeight + (hasLyric ? LAYOUT.lyricHeight : 0) + (hasOrnament ? 22 : 0) + techniqueRows * 16;
    lines.push({ measures, y, numberY: y - numberOffset, height, hasLyric, hasOrnament, techniqueRows, articulationOffset });
    y += height + LAYOUT.lineGap;
  });

  return { lines, width: W, height: y - LAYOUT.lineGap + LAYOUT.padTop + (compact ? 46 : 0)
    + (lines.some((line) => line.hasOrnament) ? 24 : 0)
    + (score.lines.some((line) => line.some((m) => m.notes.some((n) => n.fermata))) ? 24 : 0)
    + (lines.some(line => line.techniqueRows > 0) ? 24 : 0)
    + (score.lines.some(line => line.some(m => m.notes.some(n => n.articulation))) ? 24 : 0)
    + (lines.some((line) => line.measures.some((m) => m.continuesOnNext)) ? 24 : 0)
    + (showMeasureNumbers ? 24 : 0) };
}

/* ---------- 渲染 ---------- */

/**
 * 吹 / 吸箭头路径：吹气向上、吸气向下。
 * x = 竖杆中心 x，y = 文字基线 y，s = 缩放系数
 */
function arrowD(x: number, y: number, up: boolean, s = 1): string {
  const wing = 4.3 * s;   // 箭头翼半宽
  const half = 1.4 * s;   // 竖杆半宽
  const tipY = up ? y - 9 * s : y + 4.5 * s;        // 箭尖
  const tailY = up ? y + 4.5 * s : y - 9 * s;       // 杆尾
  const shoulder = up ? y - 1.5 * s : y - 3.5 * s;  // 箭头肩部
  return `M ${x} ${tipY} L ${x - wing} ${shoulder} L ${x - half} ${shoulder} L ${x - half} ${tailY} `
    + `L ${x + half} ${tailY} L ${x + half} ${shoulder} L ${x + wing} ${shoulder} Z`;
}

/** 口琴孔位标记：箭头（吹↑ / 吸↓）+ 孔号 + 压音 / 超吹符号 */
function HoleGlyph({ n, cx, y }: { n: Note; cx: number; y: number }) {
  if (n.degree === 0 || n.hole == null || !n.breath) return null;
  const color = n.breath === 'blow' ? BLOW_COLOR : DRAW_COLOR;
  const bends = n.bend ? "'".repeat(n.bend) : '';
  const ob = n.overblow ? '°' : '';
  const ty = y + LAYOUT.tabY;
  return (
    <g>
      <path d={arrowD(cx - 8, ty, n.breath === 'blow')} fill={color} />
      <text x={cx + 5} y={ty} textAnchor="middle" fontFamily={NUM_FONT}
        fontSize={14.5} fontWeight={700} fill={color}>
        {n.hole}
        {bends && <tspan fontSize={13} dy={-4}>{bends}</tspan>}
        {ob && <tspan fontSize={12} dy={bends ? 0 : -4}>{ob}</tspan>}
      </text>
    </g>
  );
}

function BarLine({ x, y, kind }: { x: number; y: number; kind: 'normal' | 'begin' | 'end' | 'final' | 'repeatBegin' | 'repeatEnd' | 'continuation' }) {
  const top = y + LAYOUT.barTop;
  const bottom = y + LAYOUT.barBottom;
  const els: React.ReactNode[] = [];
  const vline = (dx: number, w: number) => (
    <rect key={`b${dx}`} x={x + dx} y={top} width={w} height={bottom - top} fill={INK} />
  );
  const dots = (dir: 1 | -1) => (
    <g key="dots" fill={INK}>
      <circle cx={x + dir * 7} cy={top + (bottom - top) * 0.36} r={2.4} />
      <circle cx={x + dir * 7} cy={top + (bottom - top) * 0.64} r={2.4} />
    </g>
  );
  switch (kind) {
    case 'continuation': els.push(<line key="continuation" data-notation="measure-continuation"
      x1={x} x2={x} y1={top} y2={bottom} stroke={FAINT} strokeWidth={1} strokeDasharray="3 5" />); break;
    case 'normal': els.push(vline(-0.5, 1)); break;
    case 'begin': els.push(vline(-2.5, 3), vline(1.5, 1)); break;
    case 'final': els.push(vline(-1.5, 1), vline(1.5, 3)); break;
    case 'repeatBegin': els.push(vline(-2.5, 3), vline(1.5, 1), dots(1)); break;
    case 'repeatEnd': els.push(vline(-4.5, 1), vline(-0.5, 3), dots(-1)); break;
  }
  return <g>{els}</g>;
}

function NoteGlyph({ p, y, auxiliaryRow, techniqueRows, articulationOffset }: { p: PlacedNote; y: number; auxiliaryRow: boolean; techniqueRows: number; articulationOffset: number }) {
  const n = p.note;
  const els: React.ReactNode[] = [];
  const cx = p.x;
  const acc = n.accidental === 1 ? '♯' : n.accidental === -1 ? '♭' : p.showNatural ? '♮' : '';
  if (n.articulation) {
    const ay = y - articulationOffset;
    els.push(<g key="articulation" data-notation={n.articulation} fill="none" stroke={INK} strokeWidth={1.8}>
      <title>{n.articulation === 'accent' ? '重音' : '保持音'}</title>
      {n.articulation === 'accent'
        ? <path d={`M ${cx - 6} ${ay - 4} L ${cx + 6} ${ay} L ${cx - 6} ${ay + 4}`} />
        : <line x1={cx - 6} x2={cx + 6} y1={ay} y2={ay} />}
    </g>);
  }
  if (n.fermata) els.push(<g key="fermata" data-notation="fermata" fill={INK}>
    <path d={`M ${cx - 11} ${y - 41} Q ${cx} ${y - 63} ${cx + 11} ${y - 41}`} fill="none" stroke={INK} strokeWidth={1.8} />
    <circle cx={cx} cy={y - 44} r={2} />
  </g>);
  if (n.ornament) {
    const auxiliary = n.ornament.auxiliary;
    const auxiliaryAcc = auxiliary.accidental === 1 ? '♯' : auxiliary.accidental === -1 ? '♭' : p.auxiliaryNatural ? '♮' : '';
    els.push(<g key="mordent" data-notation={n.ornament.kind} fill={INK}>
      <path d={`M ${cx - 10} ${y - 23} l 4 -4 l 6 5 l 6 -5 l 4 4`} fill="none" stroke={INK} strokeWidth={2.2} />
      {n.ornament.kind === 'lower-mordent' && <line x1={cx} x2={cx} y1={y - 32} y2={y - 17} stroke={INK} strokeWidth={1.5} />}
      {auxiliaryAcc && <text x={cx} y={y - 36} textAnchor="middle" fontFamily={NUM_FONT} fontSize={12}>{auxiliaryAcc}</text>}
      <text data-notation="auxiliary-fingering" x={cx} y={y + 119} textAnchor="middle" fontFamily={NUM_FONT} fontSize={10}
        fill={auxiliary.hole == null ? INK : auxiliary.breath === 'blow' ? BLOW_COLOR : DRAW_COLOR}>辅 {holeLabel(auxiliary) || '?'}</text>
    </g>);
  }

  p.graceNotes.forEach((grace, index) => {
    const g = grace.note;
    const accidental = g.accidental === 1 ? '♯' : g.accidental === -1 ? '♭' : grace.showNatural ? '♮' : '';
    const octave = g.octave ?? 0;
    els.push(<g key={`grace${index}`} data-notation="grace-note">
      <text x={grace.x} y={y + 14} fontFamily={NUM_FONT} fontSize={14} textAnchor="middle" fill={INK}>
        {accidental && <tspan fontSize={10}>{accidental}</tspan>}{g.degree}
      </text>
      {Array.from({ length: Math.abs(octave) }, (_, dot) => <circle key={dot} cx={grace.x}
        cy={y + (octave > 0 ? -1 - dot * 5 : 20 + dot * 5)} r={1.6} fill={INK} />)}
      <line x1={grace.x - 7} x2={grace.x + 7} y1={y + 38} y2={y + 38} stroke={INK} strokeWidth={1.5} />
      {g.beats === 0.25 && <line x1={grace.x - 7} x2={grace.x + 7} y1={y + 42} y2={y + 42} stroke={INK} strokeWidth={1.5} />}
      <g transform={`translate(${grace.x}, ${y + 78}) scale(0.8) translate(${-grace.x}, ${-(y + 78)})`}>
        <HoleGlyph n={g} cx={grace.x} y={y - 20} />
      </g>
    </g>);
  });
  if (p.graceNotes.length) {
    const start = p.graceNotes[0].x;
    els.push(<path key="grace-arc" data-notation="grace-arc" d={`M ${start} ${y - 18} Q ${(start + cx) / 2} ${y - 32} ${cx - 4} ${y - 4}`}
      fill="none" stroke={INK} strokeWidth={1.1} />);
  }

  // 高八度点
  if ((n.octave ?? 0) > 0 && n.degree !== 0) {
    for (let i = 0; i < n.octave!; i++) {
      els.push(<circle key={`hd${i}`} data-notation="high-dot" cx={cx} cy={y + LAYOUT.highDotY - i * 7} r={2.2} fill={INK} />);
    }
  }
  // 简谱数字
  els.push(
    <text key="num" x={cx} y={y + LAYOUT.numberY} textAnchor="middle"
      fontFamily={NUM_FONT} fontSize={n.degree === 0 ? 19 : 21} fontWeight={600} fill={INK}>
      {acc && <tspan fontSize={14} dy={-4}>{acc}</tspan>}
      <tspan dy={acc ? 4 : 0}>{n.degree}</tspan>
      {n.dotted && noteDuration(n) < 2 && <tspan fontSize={15} dx={3}>.</tspan>}
    </text>
  );
  // 低音点
  if ((n.octave ?? 0) < 0 && n.degree !== 0) {
    for (let i = 0; i < -n.octave!; i++) {
      els.push(<circle key={`ld${i}`} data-notation="low-dot" cx={cx} cy={y + LAYOUT.lowDotY + i * 7} r={2.2} fill={INK} />);
    }
  }
  // In numbered notation, sustained notes use dashes; long rests repeat the zero.
  for (let i = 1; i < symbolCount(n); i++) {
    els.push(<text key={`dur${i}`} data-notation={n.degree === 0 ? 'rest-extension' : 'duration-dash'}
      x={cx + i * p.w / symbolCount(n)} y={y + LAYOUT.numberY} textAnchor="middle"
      fontFamily={NUM_FONT} fontSize={21} fill={INK}>{n.degree === 0 ? '0' : '−'}</text>);
  }
  // 口琴孔位标记：箭头 + 孔号（吹气↑ / 吸气↓）
  if (n.hole != null && n.breath) {
    els.push(<HoleGlyph key="tab" n={n} cx={cx} y={y} />);
  }
  n.techniques?.forEach((technique, index) => {
    els.push(<text key={`technique-${technique}`} data-notation="technique" data-technique={technique}
      x={cx} y={y + 116 + (auxiliaryRow ? 22 : 0) + index * 16} textAnchor="middle"
      fontFamily={NUM_FONT} fontSize={11} fill={INK}>{TECHNIQUE_LABELS[technique]}</text>);
  });
  // 歌词
  if (n.lyric) {
    els.push(
      <text key="ly" data-notation="lyric" x={cx} y={y + LAYOUT.lyricY + (auxiliaryRow ? 22 : 0) + techniqueRows * 16} textAnchor="middle"
        fontFamily={TITLE_FONT} fontSize={13} fill={INK}>
        {n.lyric}
      </text>
    );
  }
  return <g>{els}</g>;
}

/** 节奏下划线：把同小节内连续的短音符用横线连起来 */
function Beams({ m, y }: { m: PlacedMeasure; y: number }) {
  const els: React.ReactNode[] = [];
  const ns = m.notes;
  const level = (p: PlacedNote) => beamLevel(p.note);

  let i = 0;
  while (i < ns.length) {
    if (level(ns[i]) >= 1) {
      let j = i;
      while (j + 1 < ns.length && level(ns[j + 1]) >= 1) j++;
      const x1 = ns[i].x - ns[i].w * 0.32;
      const x2 = ns[j].x + ns[j].w * 0.32;
      els.push(<rect key={`b1-${i}`} x={x1} y={y + LAYOUT.beam1Y} width={x2 - x1} height={2.4} fill={INK} />);
      // 每一级短梁覆盖该级及更短的音符，三十二分保留三道梁。
      for (const tier of [2, 3]) {
        let k = i;
        while (k <= j) {
          if (level(ns[k]) >= tier) {
            let l = k;
            while (l + 1 <= j && level(ns[l + 1]) >= tier) l++;
            const sx = ns[k].x - ns[k].w * 0.32;
            const ex = ns[l].x + ns[l].w * 0.32;
            els.push(<rect key={`b${tier}-${k}`} data-notation={`beam-${tier}`} x={sx} y={y + LAYOUT.beam2Y + (tier - 2) * 6} width={ex - sx} height={2.4} fill={INK} />);
            k = l + 1;
          } else k++;
        }
      }
      i = j + 1;
    } else i++;
  }
  return <g>{els}</g>;
}

/** At a line break, draw both the outgoing and incoming halves of a tie. */
function Ties({ line, previous }: { line: PlacedLine; previous?: PlacedLine }) {
  const els: React.ReactNode[] = [];
  const flat: PlacedNote[] = [];
  line.measures.forEach((m) => m.notes.forEach((n) => flat.push(n)));
  const arc = (key: string, x1: number, x2: number) => {
    const yy = line.y - 13;
    const h = 7 + Math.min((x2 - x1) / 18, 6);
    els.push(<path key={key} data-notation="tie" d={`M ${x1} ${yy} Q ${(x1 + x2) / 2} ${yy - h * 2} ${x2} ${yy}`}
      stroke={INK} strokeWidth={1.4} fill="none" />);
  };
  const previousMeasure = previous?.measures[previous.measures.length - 1];
  const previousNote = previousMeasure?.notes[previousMeasure.notes.length - 1]?.note;
  if (previousNote?.tie) arc('incoming', line.measures[0].x, flat[0].x - 8);
  flat.forEach((p, i) => {
    if (!p.note.tie) return;
    const q = flat[i + 1];
    const last = line.measures[line.measures.length - 1];
    arc(`t${i}`, p.x + 8, q ? q.x - 8 : last.x + last.w);
  });
  return <g>{els}</g>;
}

function Header({ score, width }: { score: Score; width: number }) {
  const W = width;
  const compact = W < 700;
  const stars = '★'.repeat(score.difficulty) + '☆'.repeat(5 - score.difficulty);
  // 把位只保留中文，去掉括号里的英文（避免信息条溢出）
  const pos = (score.position ?? '').replace(/[（(][^）)]*[）)]/g, '').trim();
  const infoText = `${score.harmonicaKey} 调十孔口琴${pos ? ' · ' + pos : ''} · 难度 ${stars}`;
  const infoWidth = [...infoText].reduce(
    (s, ch) => s + (/[\u2e80-\u9fff\u2605\u2606·]/.test(ch) ? 12 : 6.8), 0
  ) + 26;
  return (
    <g data-score-part="header">
      <text x={W / 2} y={LAYOUT.padTop + 18} textAnchor="middle" fontFamily={TITLE_FONT}
        fontSize={compact ? 24 : 30} fontWeight={700} fill={INK}>{score.title}</text>
      {score.subtitle && (
        <text x={W / 2} y={LAYOUT.padTop + 42} textAnchor="middle" fontFamily={TITLE_FONT}
          fontSize={compact ? 11 : 14} fill={FAINT}>{score.subtitle}</text>
      )}
      {/* 左侧：调号/拍号/速度 */}
      <text x={LAYOUT.padX} y={LAYOUT.padTop + 78} fontFamily={NUM_FONT} fontSize={14} fill={INK}>
        1 = {score.key}   {score.timeSignature}{score.tempo ? `   ♩ = ${score.tempo}` : ''}
      </text>
      {/* 右侧：作曲/来源 */}
      {score.composer && (
        <text x={compact ? LAYOUT.padX : W - LAYOUT.padX} y={LAYOUT.padTop + (compact ? 101 : 78)} textAnchor={compact ? 'start' : 'end'} fontFamily={TITLE_FONT}
          fontSize={13} fill={INK}>{score.composer}</text>
      )}
      {/* 口琴信息条：宽度随文本自适应 */}
      <g transform={compact ? 'translate(0, 28)' : undefined}>
        <rect x={LAYOUT.padX} y={LAYOUT.padTop + 92} rx={4} width={infoWidth} height={22}
          fill="none" stroke={FAINT} strokeWidth={0.8} />
        <text x={LAYOUT.padX + 13} y={LAYOUT.padTop + 107} fontFamily={NUM_FONT} fontSize={12} fill={FAINT}>
          {infoText}
        </text>
      </g>
      <line x1={LAYOUT.padX} y1={LAYOUT.padTop + (compact ? 152 : 124)} x2={W - LAYOUT.padX} y2={LAYOUT.padTop + (compact ? 152 : 124)}
        stroke={FAINT} strokeWidth={0.6} />
    </g>
  );
}

/** 图例（首页底部）：吹吸颜色说明 */
function Legend({ y, width }: { y: number; width: number }) {
  const W = width;
  const x0 = LAYOUT.padX;
  const ty = y - 3.5; // 箭头基线，与文字视觉对齐
  if (width < 700) return <g fontFamily={NUM_FONT} fontSize={11} fill={FAINT}>
    <text x={x0} y={y - 42}>↑ 吹气　↓ 吸气　&apos; 每符压低半音</text>
    <text x={x0} y={y - 22}>° 超吹/超吸　~ 振音</text>
    <text x={x0} y={y}>HarpScore</text>
  </g>;
  return (
    <g fontFamily={NUM_FONT} fontSize={11.5} fill={FAINT}>
      <text x={x0} y={y}>图例：</text>
      <path d={arrowD(x0 + 45, ty, true, 0.85)} fill={BLOW_COLOR} />
      <text x={x0 + 56} y={y}>吹气</text>
      <path d={arrowD(x0 + 95, ty, false, 0.85)} fill={DRAW_COLOR} />
      <text x={x0 + 106} y={y}>吸气</text>
      <text x={x0 + 145} y={y}>
        <tspan fill={INK} fontWeight={700}>&apos;</tspan> 压音（每符半音）
      </text>
      <text x={x0 + 272} y={y}>
        <tspan fill={INK} fontWeight={700}>°</tspan> 超吹/吸
      </text>
      <text x={x0 + 342} y={y}>
        <tspan fill={INK} fontWeight={700}>~</tspan> 振音
      </text>
      <text x={W - LAYOUT.padX} y={y} textAnchor="end">HarpScore</text>
    </g>
  );
}

export interface ScoreDisplayOptions { showMeasureNumbers?: boolean }

export function ScoreSheetSvg({ score, standalone = false, pageWidth = LAYOUT.pageWidth, showMeasureNumbers = false }: { score: Score; standalone?: boolean; pageWidth?: number } & ScoreDisplayOptions) {
  const { lines, width, height } = layoutScore(score, pageWidth, showMeasureNumbers);
  const hasOrnaments = lines.some((line) => line.hasOrnament);
  const hasContinuations = lines.some((line) => line.measures.some((m) => m.continuesOnNext));
  const hasFermatas = score.lines.some((line) => line.some((m) => m.notes.some((n) => n.fermata)));
  const hasTechniques = lines.some(line => line.techniqueRows > 0);
  const hasArticulations = score.lines.some(line => line.some(m => m.notes.some(n => n.articulation)));
  const techniqueFooter = hasTechniques ? 24 : 0;
  const L = LAYOUT;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={standalone ? width : '100%'}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label={score.title}
      style={standalone ? { background: PAPER } : undefined}>
      <rect x={0} y={0} width={width} height={height} fill={PAPER} />
      <Header score={score} width={width} />
      {lines.map((line, li) => (
        <g key={li} data-score-row={li}>
          {/* 首行谱号位置：调号拍号（简谱惯例已在头部标明，行首画粗细起线） */}
          <BarLine x={line.measures[0].x} y={line.y}
            kind={line.measures[0].continuesFromPrevious ? 'continuation' : line.measures[0].measure.repeatBegin ? 'repeatBegin' : li === 0 ? 'begin' : 'normal'} />
          {line.measures[0].continuesFromPrevious && <text data-notation="measure-continuation-label"
            x={line.measures[0].x - 22} y={line.y + L.numberY} fontSize={12} fill={FAINT}>续</text>}
          {line.measures.map((m, mi) => {
            const isLast = mi === line.measures.length - 1;
            const isLastLine = li === lines.length - 1;
            const endKind = m.continuesOnNext ? 'continuation' : m.measure.repeatEnd ? 'repeatEnd'
              : isLast && isLastLine ? 'final'
              : m.measure.sectionEnd ? 'final' : 'normal';
            return (
              <g key={mi}>
                {showMeasureNumbers && <text data-notation="measure-number" data-measure-number={m.number}
                  x={m.x + 4} y={line.numberY} fontFamily={NUM_FONT} fontSize={11} fill="#6f6a60">
                  [{m.number}]{m.continuesFromPrevious ? '续' : ''}
                </text>}
                {mi > 0 && m.measure.repeatBegin && <BarLine x={m.x} y={line.y} kind="repeatBegin" />}
                {m.measure.timeSignature && <g data-notation="meter-change" fill={INK} fontFamily={NUM_FONT}
                  fontSize={16} fontWeight={600} textAnchor="middle">
                  <text x={m.x + 23} y={line.y + 24}>{m.measure.timeSignature.split('/')[0]}</text>
                  <text x={m.x + 23} y={line.y + 47}>{m.measure.timeSignature.split('/')[1]}</text>
                </g>}
                {m.notes.map((p, ni) => <NoteGlyph key={ni} p={p} y={line.y} auxiliaryRow={line.hasOrnament} techniqueRows={line.techniqueRows} articulationOffset={line.articulationOffset} />)}
                <Beams m={m} y={line.y} />
                <BarLine x={m.x + m.w} y={line.y} kind={endKind} />
              </g>
            );
          })}
          <Ties line={line} previous={lines[li - 1]} />
        </g>
      ))}
      <g data-score-part="footer">
      <g transform={showMeasureNumbers || hasArticulations ? `translate(0 ${-24 * (Number(showMeasureNumbers) + Number(hasArticulations))})` : undefined}>
      <Legend y={height - L.padTop + 26 - (hasOrnaments ? 24 : 0) - (hasContinuations ? 24 : 0) - (hasFermatas ? 24 : 0) - techniqueFooter} width={width} />
      {hasOrnaments && <text x={L.padX} y={height - L.padTop + 26 - (hasContinuations ? 24 : 0) - (hasFermatas ? 24 : 0) - techniqueFooter} fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>
        波音：主—辅—主；辅为邻音孔位，+ 吹 / − 吸
      </text>}
      {hasContinuations && <text x={L.padX} y={height - L.padTop + 26 - (hasFermatas ? 24 : 0) - techniqueFooter} fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>
        续／虚线：同一小节换行，拍数连续计算
      </text>}
      {hasFermatas && <text x={L.padX} y={height - L.padTop + 26 - techniqueFooter} fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>
        延长记号：按乐句自由延长，不固定增加拍数
      </text>}
      {hasTechniques && <text data-notation="technique-scope" x={L.padX} y={height - L.padTop + 26} fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>
        技巧文字不展开过程音；孔位仅校验已记音高。
      </text>}
      </g>
      {hasArticulations && <text data-notation="articulation-scope" x={L.padX} y={height - L.padTop + 26 - (showMeasureNumbers ? 24 : 0)}
        fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>重音 &gt;：强调；保持音 —：保持音值，不额外加拍</text>}
      {showMeasureNumbers && <text data-notation="measure-number-scope" x={L.padX} y={height - L.padTop + 26}
        fontFamily={NUM_FONT} fontSize={10} fill={FAINT}>小节号：弱起计入；续行沿用原编号</text>}
      </g>
    </svg>
  );
}

export default function ScoreSheet({ score, showMeasureNumbers = false }: { score: Score } & ScoreDisplayOptions) {
  const paper = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(LAYOUT.pageWidth);
  useEffect(() => {
    const element = paper.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setPageWidth(width < 700 ? Math.max(420, Math.round(width)) : LAYOUT.pageWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="score-paper" ref={paper}>
      <ScoreSheetSvg score={score} pageWidth={pageWidth} showMeasureNumbers={showMeasureNumbers} />
    </div>
  );
}
