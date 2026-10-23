/**
 * 导出：SVG / PNG / 打印(PDF)
 */
import type { Score } from '../types/score';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScoreSheetSvg, type ScoreDisplayOptions } from '../components/ScoreSheet';
import { flushSync } from 'react-dom';
import { paginateRows } from './printLayout';

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_');
}

/** 把曲谱渲染为独立 SVG 字符串 */
export function renderToSvgString(score: Score, pageWidth = 1080, options: ScoreDisplayOptions = {}): string {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(React.createElement(ScoreSheetSvg, { score, standalone: true, pageWidth, ...options }));
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

export function exportSvg(score: Score, options: ScoreDisplayOptions = {}) {
  const str = renderToSvgString(score, 1080, options);
  download(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(score.title)}.svg`);
}

export async function exportPng(score: Score, scale = 2, options: ScoreDisplayOptions = {}): Promise<void> {
  const str = renderToSvgString(score, 1080, options);
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
    if (!blob) throw new Error('PNG 编码失败，请尝试 SVG 导出');
    download(blob, `${safeName(score.title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Measure the actual SVG ink (including ties, lyrics and techniques) before paging. */
export function renderPrintPages(score: Score, options: ScoreDisplayOptions = {}): string[] {
  // 900 units across A4's printable width keeps the main fingering around 8.5 pt.
  const width = 900;
  const source = new DOMParser().parseFromString(renderToSvgString(score, width, options), 'image/svg+xml');
  const svg = document.importNode(source.documentElement, true) as unknown as SVGSVGElement;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none';
  container.append(svg);
  document.body.append(container);
  try {
    const header = svg.querySelector<SVGGElement>('[data-score-part="header"]')!;
    const footer = svg.querySelector<SVGGElement>('[data-score-part="footer"]')!;
    const rows = [...svg.querySelectorAll<SVGGElement>('[data-score-row]')];
    const bounds = rows.map(row => row.getBBox());
    const headerBox = header.getBBox(), footerBox = footer.getBBox();
    // A4, 12 mm margins; leave 1 mm of height for print rounding differences.
    const height = width * 272 / 186;
    const rowTop = headerBox.y + headerBox.height + 28;
    const footerTop = height - 36 - footerBox.height;
    const pages = paginateRows(bounds.map(box => box.height), rowTop, footerTop - 28);
    const ns = 'http://www.w3.org/2000/svg';
    const translated = (element: SVGElement, dy: number) => {
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('transform', `translate(0 ${dy})`);
      group.append(element.cloneNode(true));
      return group;
    };
    return pages.map((page, index) => {
      const result = document.createElementNS(ns, 'svg');
      result.setAttribute('xmlns', ns);
      result.setAttribute('viewBox', `0 0 ${width} ${height}`);
      result.setAttribute('role', 'img');
      result.setAttribute('aria-label', `${score.title} 第 ${index + 1} 页`);
      const background = document.createElementNS(ns, 'rect');
      background.setAttribute('width', String(width));
      background.setAttribute('height', String(height));
      background.setAttribute('fill', '#fffdf7');
      result.append(background, header.cloneNode(true));
      for (const row of page) result.append(translated(rows[row.index], row.top - bounds[row.index].y));
      result.append(translated(footer, footerTop - footerBox.y));
      const pageNumber = document.createElementNS(ns, 'text');
      pageNumber.setAttribute('x', String(width - 56));
      pageNumber.setAttribute('y', String(height - 12));
      pageNumber.setAttribute('text-anchor', 'end');
      pageNumber.setAttribute('font-size', '12');
      pageNumber.setAttribute('fill', '#666');
      pageNumber.textContent = `第 ${index + 1} / ${pages.length} 页`;
      result.append(pageNumber);
      return new XMLSerializer().serializeToString(result);
    });
  } finally { container.remove(); }
}

/** 打印（A4 整行分页，浏览器可另存为 PDF） */
export async function exportPdf(score: Score, options: ScoreDisplayOptions = {}) {
  const pages = renderPrintPages(score, options);
  const win = window.open('', '_blank');
  if (!win) throw new Error('打印窗口被浏览器拦截，请允许弹出窗口后重试');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>HarpScore</title>
<style>@page{size:A4 portrait;margin:12mm}body{margin:0}.print-page{width:186mm;height:272mm;break-after:page;page-break-after:always}.print-page:last-child{break-after:auto;page-break-after:auto}svg{display:block;width:100%;height:100%}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}@media screen{body{background:#ddd;padding:16px}.print-page{margin:0 auto 16px}}</style>
</head><body>${pages.map(page => `<section class="print-page">${page}</section>`).join('')}</body></html>`);
  win.document.close();
  win.document.title = `${score.title} - HarpScore`;
  await win.document.fonts.ready;
  if (!win.closed) win.print();
}

/** 导出曲谱源 JSON */
export function exportJson(score: Score) {
  download(
    new Blob([JSON.stringify(score, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeName(score.title)}.harpscore.json`
  );
}

/** Preserve even invalid JSON so a damaged library can be recovered offline. */
export function exportLibraryBackup(raw: string, recovery = false) {
  download(new Blob([raw], { type: 'application/json;charset=utf-8' }),
    `harpscore-${recovery ? 'before-restore' : 'library'}-${new Date().toISOString().slice(0, 10)}.json`);
}
