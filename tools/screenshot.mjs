import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.env.OUT || 'C:/Users/ax2/WorkBuddy/work/harpscore/tools/shots';
fs.mkdirSync(OUT, { recursive: true });

const SONGS = [
  '小星星',
  '欢乐颂',
  '友谊地久天长',
  '爱尔兰画眉',
  '铃儿响叮当',
  '送别',
  '12 小节布鲁斯练习曲',
  '压音入门练习曲',
];

const log = (...a) => { console.error('[shot]', ...a); };

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
page.setDefaultTimeout(8000);

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.score-item', { timeout: 8000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/shot_list.png` });
log('list captured');

for (const name of SONGS) {
  log('opening', name);
  await page.locator('.score-item', { hasText: name }).first().click();
  await page.waitForSelector('.score-paper', { timeout: 8000 });
  await page.waitForTimeout(400);
  const slug = name.replace(/[^\w一-龥]/g, '');
  await page.screenshot({ path: `${OUT}/shot_detail_${slug}.png` });
  await page.locator('.score-paper').screenshot({ path: `${OUT}/shot_sheet_${slug}.png` });
  log('captured', name);
}

await page.locator('.btn', { hasText: '导入曲谱' }).first().click().catch(() => {});
await page.waitForSelector('.modal', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shot_import.png` }).catch(() => {});
log('import captured');

await browser.close();
log('done:', fs.readdirSync(OUT).length, 'files');
