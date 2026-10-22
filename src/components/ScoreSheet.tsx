/**
 * ScoreSheet - 专业乐谱 SVG 渲染
 * 上行：简谱（数字 + 八度点 + 升降号 + 附点 + 节奏下划线 + 延音线）
 * 下行：口琴演奏标记（吹吸 + 孔号 + 压音符号 + 技巧）
 * 小节线 / 反复记号 / 双纵线贯穿两行
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Measure, Note, Score } from '../types/score';
import { noteDuration } from '../lib/notation';

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
}

interface PlacedMeasure {
  measure: Measure;
  x: number; // 起始 x（含小节线后）
  w: number;
  notes: PlacedNote[];
}

interface PlacedLine {
  measures: PlacedMeasure[];
  y: number;
  height: number;
  hasLyric: boolean;
}

function noteWidth(n: Note): number {
  const dur = noteDuration(n);
  if (dur >= 2) return 38 * dur;
  return Math.max(38, 30 + dur * 16);
}

function symbolCount(n: Note): number {
  return noteDuration(n) >= 2 ? noteDuration(n) : 1;
}

function beamLevel(n: Note): number {
  if (n.beats <= 0.25) return 2;
  if (n.beats <= 0.5) return 1;
  return 0;
}

export function layoutScore(score: Score, pageWidth = LAYOUT.pageWidth): { lines: PlacedLine[]; width: number; height: number } {
  const W = pageWidth;
  const compact = W < 700;
  const avail = W - LAYOUT.padX * 2;
  const lines: PlacedLine[] = [];
  let y = LAYOUT.padTop + LAYOUT.headerHeight + (compact ? 28 : 0);

  // Preserve authored line breaks but wrap dense rows instead of clipping the SVG.
  const rows: Measure[][] = [];
  score.lines.forEach((rawLine) => {
    let row: Measure[] = [];
    let rowWidth = 0;
    rawLine.forEach((measure) => {
      const width = measure.notes.reduce((sum, n) => sum + noteWidth(n), 0) + 16;
      const target = avail - (rows.length === 0 ? (compact ? 0 : 64) : 0);
      if (row.length && rowWidth + width > target / 0.85) {
        rows.push(row);
        row = [];
        rowWidth = 0;
      }
      row.push(measure);
      rowWidth += width;
    });
    if (row.length) rows.push(row);
  });
  rows.forEach((rawLine, li) => {
    const firstLineIndent = li === 0 && !compact ? 64 : 0;
    // 自然宽度
    const mWidths = rawLine.map((m) => {
      const nw = m.notes.reduce((s, n) => s + noteWidth(n), 0);
      return nw + 16; // 小节内边距
    });
    const natural = mWidths.reduce((a, b) => a + b, 0);
    const target = avail - firstLineIndent;
    const scale = Math.min(target / natural, 1.9);

    let x = LAYOUT.padX + firstLineIndent;
    const measures: PlacedMeasure[] = rawLine.map((m, mi) => {
      const mw = mWidths[mi] * scale;
      let nx = x + 8 * scale;
      const notes: PlacedNote[] = m.notes.map((n) => {
        const w = noteWidth(n) * scale;
        const cx = nx + w / (2 * symbolCount(n));
        nx += w;
        return { note: n, x: cx, w };
      });
      const pm = { measure: m, x, w: mw, notes };
      x += mw;
      return pm;
    });

    const hasLyric = rawLine.some((m) => m.notes.some((n) => n.lyric));
    const height = LAYOUT.lineBaseHeight + (hasLyric ? LAYOUT.lyricHeight : 0);
    lines.push({ measures, y, height, hasLyric });
    y += height + LAYOUT.lineGap;
  });

  return { lines, width: W, height: y - LAYOUT.lineGap + LAYOUT.padTop + (compact ? 46 : 0) };
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
  const vib = n.techniques?.includes('vibrato') ? '~' : '';
  const ty = y + LAYOUT.tabY;
  return (
    <g>
      <path d={arrowD(cx - 8, ty, n.breath === 'blow')} fill={color} />
      <text x={cx + 5} y={ty} textAnchor="middle" fontFamily={NUM_FONT}
        fontSize={14.5} fontWeight={700} fill={color}>
        {n.hole}
        {bends && <tspan fontSize={13} dy={-4}>{bends}</tspan>}
        {ob && <tspan fontSize={12} dy={bends ? 0 : -4}>{ob}</tspan>}
        {vib && <tspan fontSize={12} dy={bends || ob ? 4 : 0} dx={2}>{vib}</tspan>}
      </text>
    </g>
  );
}

function BarLine({ x, y, kind }: { x: number; y: number; kind: 'normal' | 'begin' | 'end' | 'final' | 'repeatBegin' | 'repeatEnd' }) {
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
    case 'normal': els.push(vline(-0.5, 1)); break;
    case 'begin': els.push(vline(-2.5, 3), vline(1.5, 1)); break;
    case 'final': els.push(vline(-1.5, 1), vline(1.5, 3)); break;
    case 'repeatBegin': els.push(vline(-2.5, 3), vline(1.5, 1), dots(1)); break;
    case 'repeatEnd': els.push(vline(-4.5, 1), vline(-0.5, 3), dots(-1)); break;
  }
  return <g>{els}</g>;
}

function NoteGlyph({ p, y }: { p: PlacedNote; y: number }) {
  const n = p.note;
  const els: React.ReactNode[] = [];
  const cx = p.x;
  const acc = n.accidental === 1 ? '♯' : n.accidental === -1 ? '♭' : '';

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
  // 歌词
  if (n.lyric) {
    els.push(
      <text key="ly" x={cx} y={y + LAYOUT.lyricY} textAnchor="middle"
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
      // 第二道梁：组内连续的十六分
      let k = i;
      while (k <= j) {
        if (level(ns[k]) === 2) {
          let l = k;
          while (l + 1 <= j && level(ns[l + 1]) === 2) l++;
          const sx = ns[k].x - ns[k].w * 0.32;
          const ex = ns[l].x + ns[l].w * 0.32;
          els.push(<rect key={`b2-${k}`} x={sx} y={y + LAYOUT.beam2Y} width={ex - sx} height={2.4} fill={INK} />);
          k = l + 1;
        } else k++;
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
    <g>
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
    <text x={x0} y={y - 22}>° 超吹/超吸　~ 颤音</text>
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
        <tspan fill={INK} fontWeight={700}>~</tspan> 颤音
      </text>
      <text x={W - LAYOUT.padX} y={y} textAnchor="end">HarpScore</text>
    </g>
  );
}

export function ScoreSheetSvg({ score, standalone = false, pageWidth = LAYOUT.pageWidth }: { score: Score; standalone?: boolean; pageWidth?: number }) {
  const { lines, width, height } = layoutScore(score, pageWidth);
  const L = LAYOUT;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={standalone ? width : '100%'}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label={score.title}
      style={standalone ? { background: PAPER } : undefined}>
      <rect x={0} y={0} width={width} height={height} fill={PAPER} />
      <Header score={score} width={width} />
      {lines.map((line, li) => (
        <g key={li}>
          {/* 首行谱号位置：调号拍号（简谱惯例已在头部标明，行首画粗细起线） */}
          <BarLine x={line.measures[0].x} y={line.y}
            kind={line.measures[0].measure.repeatBegin ? 'repeatBegin' : li === 0 ? 'begin' : 'normal'} />
          {line.measures.map((m, mi) => {
            const isLast = mi === line.measures.length - 1;
            const isLastLine = li === lines.length - 1;
            const endKind = m.measure.repeatEnd ? 'repeatEnd'
              : isLast && isLastLine ? 'final'
              : m.measure.sectionEnd ? 'final' : 'normal';
            return (
              <g key={mi}>
                {mi > 0 && m.measure.repeatBegin && <BarLine x={m.x} y={line.y} kind="repeatBegin" />}
                {m.notes.map((p, ni) => <NoteGlyph key={ni} p={p} y={line.y} />)}
                <Beams m={m} y={line.y} />
                <BarLine x={m.x + m.w} y={line.y} kind={endKind} />
              </g>
            );
          })}
          <Ties line={line} previous={lines[li - 1]} />
        </g>
      ))}
      <Legend y={height - L.padTop + 26} width={width} />
    </svg>
  );
}

export default function ScoreSheet({ score }: { score: Score }) {
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
      <ScoreSheetSvg score={score} pageWidth={pageWidth} />
    </div>
  );
}
