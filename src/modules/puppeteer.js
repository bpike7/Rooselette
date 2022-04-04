import puppeteer from 'puppeteer';
import tesseract from 'node-tesseract-ocr';

const { BOVADA_EMAIL, BOVADA_PASSWORD } = process.env;

export const session = {
  browser: null,
  pages: {
    tablesIndex: null,
    table: null
  }
}

export async function login() {
  session.browser = await puppeteer.launch({ headless: true, devtools: false });
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
  const heightBuffer = parseInt(num) * 31;
  await session.pages.table.screenshot({
    path: `${directory}/${num}.png`,
    clip: { x: 1152, y: 87 + heightBuffer, width: 17, height: 12 }
  });
  const read8 = (await tesseract.recognize(`${directory}/${num}.png`, { lang: "eng", oem: 1, psm: 8 })).replace('\n', '');
  const read9 = (await tesseract.recognize(`${directory}/${num}.png`, { lang: "eng", oem: 1, psm: 9 })).replace('\n', '');
  console.log('-------')
  console.log(read8)
  console.log(read9)
  return read8;
}

export async function getAccountBalance() {

}

export async function placeBet(bets) {

}

async function assignTablePage(target) {
  if (target.url().includes('reallivedealercasino')) {
    session.pages.table = await target.page();
    await session.pages.table.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 2 });
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
