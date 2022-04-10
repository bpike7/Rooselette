import puppeteer from 'puppeteer';
import tesseract from 'node-tesseract-ocr';
import redis from './redis.js';
import Big from 'big.js';

// bottom x: 400, y: 420
// even x: 515, y: 420
// red  x: 650, y: 420
// black x: 750, y: 420
// odd x: 850, y: 420
// top x: 950, y: 420

const { BOVADA_EMAIL, BOVADA_PASSWORD } = process.env;

export const session = {
  browser: null,
  pages: {
    tablesIndex: null,
    table: null
  }
}

export async function login() {
  session.browser = await puppeteer.launch({ headless: false, devtools: false });
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

export async function screenshotAndReadHistory(num) {
  const directory = 'src/screenshots/history';
  const heightBuffer = parseInt(num) * 28;
  if (!session.pages.table) return;
  await session.pages.table.screenshot({
    path: `${directory}/${num}.png`,
    clip: { x: 1133, y: 79 + heightBuffer, width: 15, height: 11 }
  });

  const normal = (await tesseract.recognize(`${directory}/${num}-alt.png`, { oem: 3, psm: 8, tessedit_char_whitelist: "0123456789" })).replace('\n', '');
  return normal;
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

export async function getBalance() {
  if (!session.pages.table) return;
  await session.pages.table.screenshot({
    path: './balance.jpeg',
    type: 'jpeg',
    quality: 100,
    clip: { x: 95, y: 640, width: 120, height: 30 },
    omitBackground: true,
  });

  const buffer = await session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    clip: { x: 95, y: 640, width: 120, height: 30 },
    omitBackground: true,
  });
  const balance = (await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 7 })).replace('\n', '').replace(/,/g, '').replace('$', '');
  return balance;
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

const clickLocation = {
  red: { x: 630, y: 420 },
  black: { x: 750, y: 420 }
};

export async function betLoop({ bet, value: betValue }, balancePrevious) {
  if (!balancePrevious) await redis.set('is_betting', true);
  const balance = await getBalance();
  if (!balance) return console.log('no balance');
  if (balancePrevious && balance !== balancePrevious) {
    const multiplesOfFiveMinusOne = Big(betValue).div(5).minus(1).toNumber();
    for (const _ of [...Array(multiplesOfFiveMinusOne)]) {
      await session.pages.table.mouse.click(clickLocation[bet].x, clickLocation[bet].y);
      await wait();
    }
    await redis.set('is_betting', false);
    await redis.set('has_bet', true);
    return console.log('BET MADE');
  }
  await session.pages.table.mouse.click(clickLocation.red.x, clickLocation.red.y);

  await wait();
  return betLoop({ bet, value: betValue }, balance);
}

// /*
// 0 = Orientation and script detection (OSD) only.
// 1 = Automatic page segmentation with OSD.
// 2 = Automatic page segmentation, but no OSD, or OCR. (not implemented)
// 3 = Fully automatic page segmentation, but no OSD. (Default)
// 4 = Assume a single column of text of variable sizes.
// 5 = Assume a single uniform block of vertically aligned text.
// 6 = Assume a single uniform block of text.
// 7 = Treat the image as a single text line.
// 8 = Treat the image as a single word.
// 9 = Treat the image as a single word in a circle.
// 10 = Treat the image as a single character.
// 11 = Sparse text. Find as much text as possible in no particular order.
// 12 = Sparse text with OSD.
// 13 = Raw line. Treat the image as a single text line,
//      bypassing hacks that are Tesseract-specific.
// */
