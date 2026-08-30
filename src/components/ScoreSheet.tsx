/**
 * ScoreSheet - 专业乐谱 SVG 渲染
 * 上行：简谱（数字 + 八度点 + 升降号 + 附点 + 节奏下划线 + 延音线）
 * 下行：口琴演奏标记（吹吸 + 孔号 + 压音符号 + 技巧）
 * 小节线 / 反复记号 / 双纵线贯穿两行
 */
import React from 'react';
import type { Measure, Note, Score } from '../types/score';
import { holeLabel } from '../lib/harmonica';

/* ---------- 排版常量 ---------- */
export const LAYOUT = {
  pageWidth: 1080,
  padX: 56,
  padTop: 40,
  headerHeight: 150,
  lineGap: 46,
  // 行内纵向位置（相对行顶）
  highDotY: 8,
  numberY: 34,
  lowDotY: 44,
  beam1Y: 54,
  beam2Y: 60,
  tabY: 88,
  lyricY: 112,
  lineBaseHeight: 100, // 不含歌词
  lyricHeight: 22,
  barTop: 10,
  barBottom: 92,
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
  const dur = Math.min(n.beats * (n.dotted ? 1.5 : 1), 4);
  return Math.max(38, 30 + dur * 16);
}

function beamLevel(n: Note): number {
  if (n.beats <= 0.25) return 2;
  if (n.beats <= 0.5) return 1;
  return 0;
}

export function layoutScore(score: Score): { lines: PlacedLine[]; width: number; height: number } {
  const W = LAYOUT.pageWidth;
  const avail = W - LAYOUT.padX * 2;
  const lines: PlacedLine[] = [];
  let y = LAYOUT.padTop + LAYOUT.headerHeight;

  score.lines.forEach((rawLine, li) => {
    const firstLineIndent = li === 0 ? 64 : 0;
    // 自然宽度
    const mWidths = rawLine.map((m) => {
      const nw = m.notes.reduce((s, n) => s + noteWidth(n), 0);
      return nw + 16; // 小节内边距
    });
    const natural = mWidths.reduce((a, b) => a + b, 0);
    const target = avail - firstLineIndent;
    const scale = Math.min(Math.max(target / natural, 0.55), 1.9);

    let x = LAYOUT.padX + firstLineIndent;
    const measures: PlacedMeasure[] = rawLine.map((m, mi) => {
      const mw = mWidths[mi] * scale;
      let nx = x + 8 * scale;
      const notes: PlacedNote[] = m.notes.map((n) => {
        const w = noteWidth(n) * scale;
        const cx = nx + w / 2;
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

  return { lines, width: W, height: y - LAYOUT.lineGap + LAYOUT.padTop };
}

/* ---------- 渲染 ---------- */

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
    els.push(<circle key="hd" cx={cx} cy={y + LAYOUT.highDotY} r={2.2} fill={INK} />);
  }
  // 简谱数字
  els.push(
    <text key="num" x={cx} y={y + LAYOUT.numberY} textAnchor="middle"
      fontFamily={NUM_FONT} fontSize={n.degree === 0 ? 19 : 21} fontWeight={600} fill={INK}>
      {acc && <tspan fontSize={14} dy={-4}>{acc}</tspan>}
      <tspan dy={acc ? 4 : 0}>{n.degree}</tspan>
      {n.dotted && <tspan fontSize={15} dx={3}>.</tspan>}
    </text>
  );
  // 低音点
  if ((n.octave ?? 0) < 0 && n.degree !== 0) {
    els.push(<circle key="ld" cx={cx} cy={y + LAYOUT.lowDotY} r={2.2} fill={INK} />);
  }
  // 口琴孔位标记
  const label = holeLabel(n);
  if (label) {
    const color = n.breath === 'blow' ? BLOW_COLOR : DRAW_COLOR;
    els.push(
      <text key="tab" x={cx} y={y + LAYOUT.tabY} textAnchor="middle"
        fontFamily={NUM_FONT} fontSize={14.5} fontWeight={700} fill={color}>
        {label}
        {n.techniques?.includes('vibrato') && <tspan dx={3} fontSize={12}>~</tspan>}
      </text>
    );
  } else if (n.degree === 0) {
    // 休止符位置留白
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

/** 延音线（弧线，仅在同一行内绘制） */
function Ties({ line }: { line: PlacedLine }) {
  const els: React.ReactNode[] = [];
  const flat: PlacedNote[] = [];
  line.measures.forEach((m) => m.notes.forEach((n) => flat.push(n)));
  flat.forEach((p, i) => {
    if (!p.note.tie || i + 1 >= flat.length) return;
    const q = flat[i + 1];
    const x1 = p.x + p.w * 0.22;
    const x2 = q.x - q.w * 0.22;
    const yy = line.y + LAYOUT.numberY - 24;
    const h = 7 + Math.min((x2 - x1) / 18, 6);
    els.push(
      <path key={`t${i}`} d={`M ${x1} ${yy} Q ${(x1 + x2) / 2} ${yy - h * 2} ${x2} ${yy}`}
        stroke={INK} strokeWidth={1.4} fill="none" />
    );
  });
  return <g>{els}</g>;
}

function Header({ score }: { score: Score }) {
  const W = LAYOUT.pageWidth;
  const stars = '★'.repeat(score.difficulty) + '☆'.repeat(5 - score.difficulty);
  return (
    <g>
      <text x={W / 2} y={LAYOUT.padTop + 18} textAnchor="middle" fontFamily={TITLE_FONT}
        fontSize={30} fontWeight={700} fill={INK}>{score.title}</text>
      {score.subtitle && (
        <text x={W / 2} y={LAYOUT.padTop + 42} textAnchor="middle" fontFamily={TITLE_FONT}
          fontSize={14} fill={FAINT}>{score.subtitle}</text>
      )}
      {/* 左侧：调号/拍号/速度 */}
      <text x={LAYOUT.padX} y={LAYOUT.padTop + 78} fontFamily={NUM_FONT} fontSize={14} fill={INK}>
        1 = {score.key}   {score.timeSignature}{score.tempo ? `   ♩ = ${score.tempo}` : ''}
      </text>
      {/* 右侧：作曲/来源 */}
      {score.composer && (
        <text x={W - LAYOUT.padX} y={LAYOUT.padTop + 78} textAnchor="end" fontFamily={TITLE_FONT}
          fontSize={13} fill={INK}>{score.composer}</text>
      )}
      {/* 口琴信息条 */}
      <g>
        <rect x={LAYOUT.padX} y={LAYOUT.padTop + 92} rx={4} width={14 * (score.harmonicaKey.length + 12)} height={22}
          fill="none" stroke={FAINT} strokeWidth={0.8} />
        <text x={LAYOUT.padX + 10} y={LAYOUT.padTop + 107} fontFamily={NUM_FONT} fontSize={12} fill={FAINT}>
          {`${score.harmonicaKey} 调十孔口琴${score.position ? ' · ' + score.position : ''} · 难度 ${stars}`}
        </text>
      </g>
      <line x1={LAYOUT.padX} y1={LAYOUT.padTop + 124} x2={W - LAYOUT.padX} y2={LAYOUT.padTop + 124}
        stroke={FAINT} strokeWidth={0.6} />
    </g>
  );
}

/** 图例（首页底部）：吹吸颜色说明 */
function Legend({ y }: { y: number }) {
  const W = LAYOUT.pageWidth;
  return (
    <g fontFamily={NUM_FONT} fontSize={11.5} fill={FAINT}>
      <text x={LAYOUT.padX} y={y}>
        图例：<tspan fill={BLOW_COLOR} fontWeight={700}>+N</tspan> 吹气 N 孔　
        <tspan fill={DRAW_COLOR} fontWeight={700}>-N</tspan> 吸气 N 孔　
        <tspan fontWeight={700}>&apos;</tspan> 压音（每符半音）　
        <tspan fontWeight={700}>°</tspan> 超吹　~ 颤音
      </text>
      <text x={W - LAYOUT.padX} y={y} textAnchor="end">HarpScore</text>
    </g>
  );
}

export function ScoreSheetSvg({ score, standalone = false }: { score: Score; standalone?: boolean }) {
  const { lines, width, height } = layoutScore(score);
  const L = LAYOUT;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={standalone ? width : '100%'}
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label={score.title}
      style={standalone ? { background: PAPER } : undefined}>
      <rect x={0} y={0} width={width} height={height} fill={PAPER} />
      <Header score={score} />
      {lines.map((line, li) => (
        <g key={li}>
          {/* 首行谱号位置：调号拍号（简谱惯例已在头部标明，行首画粗细起线） */}
          <BarLine x={line.measures[0].x} y={line.y} kind={li === 0 ? 'begin' : 'normal'} />
          {line.measures[0].measure.repeatBegin && (
            <BarLine x={line.measures[0].x} y={line.y} kind="repeatBegin" />
          )}
          {line.measures.map((m, mi) => {
            const isLast = mi === line.measures.length - 1;
            const isLastLine = li === lines.length - 1;
            const endKind = m.measure.repeatEnd ? 'repeatEnd'
              : isLast && isLastLine ? 'final'
              : m.measure.sectionEnd ? 'final' : 'normal';
            return (
              <g key={mi}>
                {m.notes.map((p, ni) => <NoteGlyph key={ni} p={p} y={line.y} />)}
                <Beams m={m} y={line.y} />
                <BarLine x={m.x + m.w} y={line.y} kind={endKind} />
              </g>
            );
          })}
          <Ties line={line} />
        </g>
      ))}
      <Legend y={height - L.padTop + 26} />
    </svg>
  );
}

export default function ScoreSheet({ score }: { score: Score }) {
  return (
    <div className="score-paper">
      <ScoreSheetSvg score={score} />
    </div>
  );
}
