export interface PrintedRow { index: number; top: number }

/** Keep every row's entire painted area on one page, in original order. */
export function paginateRows(heights: number[], top: number, bottom: number, gap = 28): PrintedRow[][] {
  const pages: PrintedRow[][] = [];
  let page: PrintedRow[] = [];
  let cursor = top;
  for (const [index, height] of heights.entries()) {
    if (!Number.isFinite(height) || height <= 0 || height > bottom - top) {
      throw new Error(`第 ${index + 1} 行超出打印区域，请调整曲谱排版后重试`);
    }
    if (page.length && cursor + height > bottom) {
      pages.push(page);
      page = [];
      cursor = top;
    }
    page.push({ index, top: cursor });
    cursor += height + gap;
  }
  if (page.length) pages.push(page);
  // Avoid a nearly empty final page when one preceding row can safely join it.
  if (pages.length > 1) {
    const last = pages[pages.length - 1], previous = pages[pages.length - 2];
    const move = previous[previous.length - 1];
    if (last.length === 1 && previous.length > 2
      && heights[move.index] + gap + heights[last[0].index] <= bottom - top) {
      previous.pop();
      last[0].top = top + heights[move.index] + gap;
      last.unshift({ index: move.index, top });
    }
  }
  return pages;
}
