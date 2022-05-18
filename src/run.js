import { getAverageColor } from 'fast-average-color-node';
import redis from './modules/redis.js';
import { session, getBalance } from './tables.js';
import tesseract from 'node-tesseract-ocr';
import getStreaks from './streaks.js';
import { addToLedger } from './ledger.js';
import Big from 'big.js';

const {
  HISTORY_LENGTH,
  STREAK_THRESHOLD_HALF,
  REBET_ATTEMPT_CAP,
} = process.env;

const colors = {
  red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
  black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
  green: [0]
};

const betValueMap = {
  1: 5,
  2: 15,
  3: 35
};

const lossValueMap = {
  1: -5,
  2: -20,
  3: -55
};

const winValueMap = {
  5: 5,
  15: 10,
  35: 15
};


const clickLocation = {
  bottom: { x: 400, y: 420 },
  even: { x: 510, y: 420 },
  red: { x: 630, y: 420 },
  black: { x: 740, y: 420 },
  odd: { x: 850, y: 420 },
  top: { x: 960, y: 420 }
};

// TODO implement staleTimer
let staleTimer = setInterval(async () => {
  console.log('RESET')
}, 1000 * 60);

export default async function () {
  // derive new bets
  const balance = await getBalance();
  const history = await getHistory();

  const betsPrevious = await redis.get('bets_active') || [];

  if (history.slice(0, parseInt(STREAK_THRESHOLD_HALF)).includes(0)) {
    await addToLedger([
      ...betsPrevious.map(b => ({
        ...b,
        result: 'loss',
        creditDebit: lossValueMap[b.attempt],
        balance: Big(b.balancePrior).minus(lossValueMap[b.attempt]).toNumber()
      }))
    ]);
    await redis.set('bets_active', []);
    return;
  }

  const streaks = getStreaks(history);
  console.log('-------------------------------');
  console.log(history);
  console.log(streaks);

  const { bets, losses } = streaks
    .filter(({ streak }) => streak >= parseInt(STREAK_THRESHOLD_HALF))
    .reduce((acc, bet) => {
      const { type, patternId, pattern, nextInPatternIndex } = bet;
      const types = type.split('_');
      const streakBreaker = types.filter(t => t !== pattern[nextInPatternIndex])[0];
      const previous = betsPrevious.find((bp) => bp.patternId === patternId);
      bet.attempt = previous ? previous.attempt + 1 : 1;
      bet.pattern = sortPattern(pattern);
      bet.bet = streakBreaker;
      bet.value = betValueMap[bet.attempt];
      bet.balancePrior = balance;
      if (bet.attempt > parseInt(REBET_ATTEMPT_CAP)) acc.losses.push(bet);
      else acc.bets.push(bet);
      return acc;
    }, { bets: [], losses: [] });

  const wins = betsPrevious.filter(b => {
    if (bets.some(b2 => b2.type === b.type)) return false;
    if (losses.some(b2 => b2.type === b.type)) return false;
    return true;
  });

  console.log('WINS: ', wins);
  console.log('LOSS: ', losses);
  console.log('CONT: ', bets);

  await addToLedger([
    ...losses.map(b => ({
      ...b,
      result: 'loss',
      creditDebit: -55,
      balance: Big(b.balancePrior).minus(55).toNumber()
    })),
    ...wins.map(b => ({
      ...b,
      result: 'win',
      creditDebit: winValueMap[b.value],
      balance: Big(b.balancePrior).plus(winValueMap[b.value]).toNumber()
    })),
  ]);

  for (const { bet, value } of bets) {
    console.log('STARTING BET ON: ', bet, value);
    const clicks = Big(value).div(5).toNumber();
    for (const _ of [...Array(clicks)]) {
      console.log('click', clickLocation[bet].x, clickLocation[bet].y);
      await session.pages.table.mouse.click(clickLocation[bet].x, clickLocation[bet].y);
      await wait();
    }
  }

  await redis.set('bets_active', bets);
}

async function getHistory() {
  await session.pages.table.mouse.click(50, 175);
  await wait();
  const history = await Promise.all([...Array(parseInt(HISTORY_LENGTH))].map(async (_, n) => {
    const widthBuffer = parseInt(n) * 30;
    const buffer = await session.pages.table.screenshot({
      type: 'jpeg', quality: 100,
      clip: { x: 182 + widthBuffer, y: 150, width: 20, height: 12 },
      omitBackground: true
    });
    const { value } = await getAverageColor(buffer, { ignoredColor: [255, 255, 255, 255] });
    const color = resolveColor(value);
    if (color === 'green') {
      console.log(n, ' green');
      return 0;
    }
    const numberPool = colors[color];

    const readSingle = parseInt(await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 10 }));
    if (!Number.isNaN(readSingle) && numberPool.includes(readSingle)) return readSingle;
    const readDuo = parseInt(await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 8 }));
    if (!Number.isNaN(readDuo) && numberPool.includes(readDuo)) return readDuo;
    const readFinal = parseInt(await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 7 }));
    if (!Number.isNaN(readFinal) && numberPool.includes(readFinal)) return readFinal;

    if (color === 'black') {
      const readRaw = await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 8 });
      if (readRaw.includes('ar')) return 17;
      return 35;
    } else if (color === 'red') {
      const readRaw = await tesseract.recognize(buffer, { lang: "eng", oem: 1, psm: 10 });
      if (readRaw.trim() === 'a') return 1;
      return 9;
    }
    console.log('NOTHING FOUND: ', n);
  }));
  await session.pages.table.mouse.click(50, 175);
  return history;
}

function resolveColor(value) {
  const [r, g, b, a] = value;
  if (g >= 160) return 'green';
  else if (r > 165) return 'red';
  else return 'black';
}


// async function handleLineItems(betsNow, balancePrior) {



//   const { renewed, halted } = betsNow.reduce((acc, b) => {
//     if (b.streakOverThreshold <= parseInt(REBET_ATTEMPT_CAP)) acc.renewed.push(b);
//     else acc.halted.push(b);
//     return acc;
//   }, { renewed: [], halted: [] });

//   await redis.set('bets_active', renewed);

//   // resolve the previously lost (completed) bets from the halted bets 
//   const betsHardLost = betsPrevious.filter(bp => halted.some(h => h.patternId === bp.patternId));

//   const newLedgerActivity = [];
//   if (betsHardLost.length > 0) newLedgerActivity.push(convertToLedgerActivity('losses', betsHardLost));
//   if (betsWon.length > 0) newLedgerActivity.push(convertToLedgerActivity('wins', betsWon));

//   if (newLedgerActivity <= 1) return newLedgerActivity.flat();

//   const { balance, items } = newLedgerActivity.flat().reduce((acc, item) => {
//     acc.balance += item.creditDebit;
//     acc.items.push({
//       ...item,
//       balance: null
//     });
//     return acc;
//   }, { balance: balancePrior, items: [] });

//   items.push({
//     patternId: 'MULTI',
//     balance
//   });
//   return items;
// }

function convertToLedgerActivity(result, bets) {
  if (result === 'wins') return bets.map(b => {
    const creditDebit =
      b.value === 5 ? 5
        : b.value === 15 ? 10
          : b.value === 35 ? 15 : console.log('Error finding profit');
    return {
      result: 'wins' ? 'win' : 'loss',
      ...b,
      balance: Big(b.balance).plus(creditDebit).toNumber(),
      creditDebit
    };
  });

  if (result === 'losses') return bets.map(b => {
    const creditDebit = -55
    return {
      result: 'wins' ? 'win' : 'loss',
      ...b,
      balance: Big(b.balance).plus(creditDebit).toNumber(),
      creditDebit
    };
  });
}

function sortPattern(pattern) {
  return pattern.sort((a, b) => a > b ? -1 : 1);
}



async function placeBets(bets) {
  for (const { bet, value } of bets) {
    const multiplesOfFiveMinusOne = Big(value).div(5).toNumber();
    for (const _ of [...Array(multiplesOfFiveMinusOne)]) {
      await session.pages.table.mouse.click(clickLocation[bet].x, clickLocation[bet].y);
      await wait();
    }
  }
}

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
