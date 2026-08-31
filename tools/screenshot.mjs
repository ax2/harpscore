import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.env.OUT || 'C:/Users/ax2/WorkBuddy/work/harpscore/tools/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 1) 曲库列表首页（全屏，展示整体布局）
await page.screenshot({ path: `${OUT}/shot_list.png` });

// 2) 《送别》详情：专业琴谱渲染 + 工具栏 + 分析面板
await page.locator('.score-item', { hasText: '送别' }).click();
await page.waitForSelector('.score-paper');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/shot_detail_farewell.png` });
// 单独裁出琴谱 SVG 区域，文章内高清展示
await page.locator('.score-paper').screenshot({ path: `${OUT}/shot_sheet_farewell.png` });

// 3) 《12 小节布鲁斯练习曲》详情：压音标记展示
await page.locator('.score-item', { hasText: '12 小节' }).click();
await page.waitForSelector('.score-paper');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/shot_detail_blues.png` });
await page.locator('.score-paper').screenshot({ path: `${OUT}/shot_sheet_blues.png` });

// 4) JSON 导入弹窗
await page.locator('.btn', { hasText: '导入曲谱' }).first().click();
await page.waitForSelector('.modal');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot_import.png` });

await browser.close();
console.log('screenshots done:', fs.readdirSync(OUT));
