import puppeteer from 'puppeteer';
import redis from './modules/redis.js';
import tesseract from 'node-tesseract-ocr';

const { SHOW_BROWSER, BOVADA_EMAIL, BOVADA_PASSWORD } = process.env;

export const session = {
  browser: null,
  pages: {
    tablesIndex: null,
    table: null
  }
};

export async function initialize() {
  await login();
  await openNewTablePage();
  await redis.set('bets_active', []);
}

export async function login() {
  session.browser = await puppeteer.launch({ headless: SHOW_BROWSER === 'false', devtools: false });
  session.browser.on('targetcreated', assignTablePage);
  session.pages.tablesIndex = await session.browser.newPage();
  const { tablesIndex: page } = session.pages;
  await page.goto('https://www.bovada.lv/live-dealer');
  await page.click('#headerUnloggedLogin');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await page.type('#email', BOVADA_EMAIL, { delay: 30 });
  await page.type('#login-password', BOVADA_PASSWORD, { delay: 30 });
  await page.click('#login-submit');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  // occasional 2 factor step: #verificationCode-code #verification-code-submit
}

export async function openNewTablePage() {
  const cards = await session.pages.tablesIndex.$$('body > bx-site > ng-component > div > bx-live-dealer-page > div > section:nth-child(2) > dynamic-cards-list > div > dynamic-card');
  let autorouletteIndex;
  await Promise.all(cards.map(async (card, i) => {
    if (autorouletteIndex) return;
    const text = (await getText(card)).toLowerCase();
    if (text.includes('european roulette') && text.includes('autoroulette')) {
      autorouletteIndex = i;
    }
  }));
  await session.pages.tablesIndex.click(`body > bx-site > ng-component > div > bx-live-dealer-page > div > section:nth-child(2) > dynamic-cards-list > div > dynamic-card:nth-child(${autorouletteIndex + 1}) > article > div > div.dynamic-card-content > div > button:nth-child(2)`);
  await session.pages.tablesIndex.waitForNavigation({ waitUntil: 'networkidle2' });
  await wait(13000);
}

export async function getTableStatus() {
  if (!session.pages.table) return 'not_found';
  const buffer = await session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    clip: { x: 680, y: 640, width: 150, height: 30 },
    omitBackground: true,
  });
  const status = (await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 7 })).replace('\n', '').toLowerCase();
  if (status.includes('place') || status.includes('last')) return 'open';
  else if (status.includes('progress')) return 'closed';
  else if (!status.includes(['red', 'black', 'green', '0'])) return 'stale';
  else return 'closed';
}

export async function getBalance() {
  const buffer = await session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    clip: { x: 95, y: 640, width: 120, height: 30 },
    omitBackground: true,
  });
  const balance = (await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 7 })).replace('\n', '').replace(/,/g, '').replace('$', '');
  return parseFloat(balance);
}


export async function screenshotTableHistory(num) {
  const heightBuffer = parseInt(num) * 28;
  if (!session.pages.table) return;
  return session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    clip: { x: 1133, y: 79 + heightBuffer, width: 15, height: 11 },
    omitBackground: true,
  });
}


async function assignTablePage(target) {
  if (target.url().includes('reallivedealercasino')) {
    session.pages.table = await target.page();
    await session.pages.table.setViewport({ width: 1500, height: 670, deviceScaleFactor: 5 });
  }
}


async function getText(element) {
  return await (await element.getProperty('innerText')).jsonValue();
}

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
