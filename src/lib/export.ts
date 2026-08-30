/**
 * 导出：SVG / PNG / 打印(PDF)
 */
import type { Score } from '../types/score';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScoreSheetSvg } from '../components/ScoreSheet';
import { flushSync } from 'react-dom';

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_');
}

/** 把曲谱渲染为独立 SVG 字符串 */
export function renderToSvgString(score: Score): string {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(React.createElement(ScoreSheetSvg, { score, standalone: true }));
  });
  const svg = container.querySelector('svg');
  const str = svg ? new XMLSerializer().serializeToString(svg) : '';
  root.unmount();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${str}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportSvg(score: Score) {
  const str = renderToSvgString(score);
  download(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(score.title)}.svg`);
}

export async function exportPng(score: Score, scale = 2): Promise<void> {
  const str = renderToSvgString(score);
  const svgBlob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG 加载失败'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale || 1080 * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 不可用');
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) download(blob, `${safeName(score.title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 打印（浏览器可另存为 PDF） */
export function exportPdf(score: Score) {
  const str = renderToSvgString(score);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${score.title} - HarpScore</title>
<style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center}svg{max-width:100%;height:auto}</style>
</head><body>${str}<script>window.onload=()=>{window.print()}<\/script></body></html>`);
  win.document.close();
}

/** 导出曲谱源 JSON */
export function exportJson(score: Score) {
  download(
    new Blob([JSON.stringify(score, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeName(score.title)}.harpscore.json`
  );
}
