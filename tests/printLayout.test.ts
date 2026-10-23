import assert from 'node:assert/strict';
import test from 'node:test';
import { paginateRows } from '../src/lib/printLayout';

test('pagination preserves every complete variable-height row exactly once', () => {
  const heights = [100, 150, 220, 80, 200, 130, 180, 95];
  const pages = paginateRows(heights, 180, 700, 28);
  assert.ok(pages.length > 1);
  assert.deepEqual(pages.flat().map(row => row.index), heights.map((_, i) => i));
  for (const page of pages) {
    assert.equal(page[0].top, 180);
    page.forEach((row, i) => {
      assert.ok(row.top + heights[row.index] <= 700);
      if (i > 0) assert.ok(row.top >= page[i - 1].top + heights[page[i - 1].index] + 28);
    });
  }
});

test('an exact page fit does not create a blank page or include a trailing gap', () => {
  assert.deepEqual(paginateRows([220, 252], 100, 600, 28), [[{ index: 0, top: 100 }, { index: 1, top: 348 }]]);
  assert.deepEqual(paginateRows([500, 1], 100, 600), [[{ index: 0, top: 100 }], [{ index: 1, top: 100 }]]);
});

test('unmeasurable and oversized rows fail explicitly instead of clipping music', () => {
  for (const height of [0, -1, NaN, Infinity, 501]) assert.throws(() => paginateRows([height], 100, 600), /第 1 行/);
});

test('a short orphan tail shares the final page with a preceding row when space permits', () => {
  const pages = paginateRows(Array(7).fill(100), 0, 450, 20);
  assert.deepEqual(pages.map(page => page.length), [3, 2, 2]);
  assert.deepEqual(pages.flat().map(row => row.index), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(pages[2].map(row => row.top), [0, 120]);
  assert.deepEqual(paginateRows([100, 100, 100, 350], 0, 450).map(page => page.length), [3, 1]);
});
