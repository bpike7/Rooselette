import { getAverageColor } from 'fast-average-color-node';
import redis from './modules/redis.js';
import { getBalance, getTableStatus } from './tables.js';
import tesseract from 'node-tesseract-ocr';
import getStreaks from './streaks.js';
import * as Slack from './modules/slack.js';
import { addToLedger } from './ledger.js';
import Big from 'big.js';

const {
  HISTORY_LENGTH,
  STREAK_THRESHOLD_HALF,
  BET_SIZE = 5,
  REBET_ATTEMPT_CAP,
  REBET_GROWTH
} = process.env;


export default async function () {
  // const tableStatus = await getTableStatus();
  const tableStatus = 'open';
  if (tableStatus !== 'open') return;

  const balancePrior = 100; // await getBalance();

  // derive new bets
  // const history = await getHistory()
  // const historyConvertedToNumbers = history.map(c => c === 'red' ? 1 : c === 'black' ? 2 : 0);
  const streaks = getStreaks([1, 1, 1, 1, 1, 1, 1, 1, 2]);
  const betsNow = resolveCurrentBets(streaks);

  const lineItems = await resolveLineItems(balancePrior, betsNow);
  await addToLedger(lineItems);

  // await addBetsToPlacementQueue(renewed);
}

async function getHistory() {
  const historyColors = await Promise.all([...Array(parseInt(HISTORY_LENGTH))].map((_, i) => i).map(async n => {
    const heightBuffer = parseInt(n) * 28;
    const buffer = await session.pages.table.screenshot({
      type: 'jpeg', quality: 100,
      clip: { x: 1133, y: 79 + heightBuffer, width: 15, height: 11 },
      omitBackground: true
    });
    const { value } = await getAverageColor(buffer, { ignoredColor: [255, 255, 255, 255] });
    const [r, g, b, a] = value;
    if (r >= 94 && r <= 96 && g >= 170 && g <= 174) return 'green';
    else if (r > 165) return 'red';
    else return 'black';
  }));
  return !historyColors.every((val, _, arr) => val === arr[0]) ? historyColors : null
}


// TODO - do not allow bets on multiple patterns of same type
function resolveCurrentBets(streaks) {
  return streaks
    .filter(({ streak }) => streak >= parseInt(STREAK_THRESHOLD_HALF))
    .map(({ type, patternId, pattern, nextInPatternIndex, streak }) => {
      const types = type.split('_');
      const streakBreaker = types.filter(t => t !== pattern[nextInPatternIndex])[0];
      const streakOver = streak - STREAK_THRESHOLD_HALF;
      const number = streakOver * 2;
      let n1 = BET_SIZE, n2 = BET_SIZE, nextTerm;
      for (let i = 1; i <= number; i++) {
        nextTerm = calculateNextValue(n1);
        n1 = n2;
        n2 = nextTerm;
      }
      return {
        patternId,
        pattern: sortPattern(pattern),
        bet: streakBreaker,
        value: n1,
        streakOverThreshold: streakOver
      };
    });
}

async function resolveLineItems(balancePrior, betsNow) {
  // look for previous bets and compare to current bets
  const betsPrevious = await redis.get('bets_active') || [];

  const { won: betsWon, lost: betsLost } = betsPrevious.reduce((acc, betPrevious) => {
    const { patternId, bet, value } = betPrevious;
    // find matching bet between previous and now bets
    const recurring = betsNow.find(b => b.patternId === patternId);
    if (!recurring) acc.won.push(betPrevious);
    else if (recurring.value > value) acc.lost.push(betPrevious);
    return acc;
  }, { won: [], lost: [] });


  const { renewed, halted } = betsNow.reduce((acc, b) => {
    if (b.streakOverThreshold <= parseInt(REBET_ATTEMPT_CAP)) acc.renewed.push(b);
    else acc.halted.push(b);
    return acc;
  }, { renewed: [], halted: [] });

  await redis.set('bets_active', renewed);

  // resolve the previously lost (completed) bets from the halted bets 
  const betsHardLost = betsPrevious.filter(bp => halted.some(h => h.patternId === bp.patternId));

  const newLedgerActivity = [];
  if (betsHardLost.length > 0) newLedgerActivity.push(convertToLedgerActivity('losses', betsHardLost, balancePrior));
  if (betsWon.length > 0) newLedgerActivity.push(convertToLedgerActivity('wins', betsWon, balancePrior));

  return newLedgerActivity.flat();
}

function calculateNextValue(previousValue) {
  return previousValue * 2 + Big(previousValue).times(parseFloat(REBET_GROWTH)).div(5).round().mul(5).toNumber();
}

function convertToLedgerActivity(result, bets, balancePrior) {
  if (result === 'wins') return bets.map(b => {
    const creditDebit =
      b.value === 5 ? 5
        : b.value === 15 ? 10
          : b.value === 50 ? 30 : console.log('Error finding profit');
    return {
      ...b,
      balanceNew: Big(balancePrior).plus(creditDebit).toNumber(),
      creditDebit
    };
  });

  if (result === 'losses') return bets.map(b => {
    const creditDebit = -70
    return {
      ...b,
      balanceNew: Big(balancePrior).plus(creditDebit).toNumber(),
      creditDebit
    };
  });
}

function sortPattern(pattern) {
  return pattern.sort((a, b) => a > b ? -1 : 1);
}

async function addBetsToQueue(bets) {
  const queue = await redis.get('bet_queue') || [];


}
