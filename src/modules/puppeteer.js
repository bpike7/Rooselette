import puppeteer from 'puppeteer';
import tesseract from 'node-tesseract-ocr';
import * as Slack from './slack.js';
import redis from './redis.js';
import Big from 'big.js';
import { addToLedger } from '../ledger.js';

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

async function assignTablePage(target) {
  if (target.url().includes('reallivedealercasino')) {
    session.pages.table = await target.page();
    await session.pages.table.setViewport({ width: 1500, height: 670, deviceScaleFactor: 5 });
  }
}

export async function checkForTableExpiration() {
  console.log('CHECKING FOR EXPIRATION');
  if (!session.pages.table) return;
  const buffer = await session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    omitBackground: true,
  });
  const textAll = (await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 6 }));
  if (textAll.includes('has expired')) {
    try {
      await session.pages.table.click('#general-error-lobby > div');
      await wait(1000);
      await openNewTablePage();
    } catch (err) {
      console.log(err);
    }
  }
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
  const buffer = await session.pages.table.screenshot({
    type: 'jpeg',
    quality: 100,
    clip: { x: 95, y: 640, width: 120, height: 30 },
    omitBackground: true,
  });
  const balance = (await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 7 })).replace('\n', '').replace(/,/g, '').replace('$', '');
  return balance;
}



const clickLocation = {
  red: { x: 630, y: 420 },
  black: { x: 800, y: 420 }
};

export async function betLoop({ bet, value: betValue }, balancePrevious) {
  // If this is the first pass through, set is_betting true
  if (!balancePrevious) await redis.set('is_betting', true);

  // This prevents the top level cron from running workflow twice and double betting same bet
  const placedBet = await redis.get('bet_placed');
  if (placedBet && placedBet.bet === bet && placedBet.value === betValue) return;

  const balance = await getBalance();

  console.log('BALANCE: ', balance);

  // If not able to get balance AFTER previously being able to, check if table session expired
  if (!balance) return checkForTableExpiration();

  // If balance has changed, assume betting window is open and one of the desired bets have already been placed
  if (balancePrevious && balance !== balancePrevious) {
    const multiplesOfFiveMinusOne = Big(betValue).div(5).minus(1).toNumber();
    let index = 1;
    for (const _ of [...Array(multiplesOfFiveMinusOne)]) {
      console.log('CLICK: ', index + 1, { bet, value: betValue })
      await session.pages.table.mouse.click(clickLocation[bet].x, clickLocation[bet].y);
      await wait();
      index++;
    }
    await redis.set('is_betting', false);
    const balance_after_bet = await getBalance();
    await redis.set('bet_placed', { ...placedBet, [bet]: betValue, balance_after_bet });
    await Slack.notifyBet(JSON.stringify({ bet, value, balance_after_bet }));
    await addToLedger({ bet, value: betValue }, balance_after_bet);
    return console.log('BET MADE');
  }

  // Attempt initial bet once to test if betting window is open
  await session.pages.table.mouse.click(clickLocation[bet].x, clickLocation[bet].y);
  await wait();
  return betLoop({ bet, value: betValue }, balance);
}

async function getText(element) {
  return await (await element.getProperty('innerText')).jsonValue();
}

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
