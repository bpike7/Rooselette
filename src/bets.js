import redis from './modules/redis.js';
import getStreaksFromHistory from './streaks.js';
import getStreaksFromHistoryColors from './streaksColors.js';
import { getSheetData, hubRangeMap } from './modules/googleSheets.js';
import { betLoop } from './modules/puppeteer.js';
import Slack from './modules/slack.js';

const {
  ROOSELETTE_SPREADSHEET_ID,
  STREAK_THRESHOLD_HALF = 6,
  BET_SIZE = 5
} = process.env;


export default async function () {
  await redis.set('is_betting', true);
  const history = (await redis.get('history_colors')).map(c => c === 'red' ? 1 : c === 'black' ? 2 : 0);
  console.log(history);
  const streaks = getStreaksFromHistoryColors(history);
  console.log(streaks);
  const bets = convertStreaksToBets(streaks);
  for (const betInfo of bets) {
    await Slack.notifyBet();
    await betLoop(betInfo);
  }
  await redis.set('is_betting', false);
}

function convertStreaksToBets(streaks) {
  return streaks.map(({ type, pattern, nextInPatternIndex, patternCompletions, streak }) => {
    const types = type.split('_');
    const streakBreaker = types.filter(t => t !== pattern[nextInPatternIndex])[0];
    const streakOver = streak - STREAK_THRESHOLD_HALF;

    const number = streakOver * 2
    let n1 = BET_SIZE, n2 = BET_SIZE, nextTerm;

    for (let i = 1; i <= number; i++) {
      nextTerm = n1 * 2 + 5;
      n1 = n2;
      n2 = nextTerm;
    }

    return {
      bet: streakBreaker,
      value: n1
    }
  });
}

async function getHistoryFromSheet() {
  const { f, l } = (await getSheetData(ROOSELETTE_SPREADSHEET_ID, hubRangeMap.hub_history))
    .reduce((acc, [first, last]) => {
      acc.f.push(parseInt(first));
      acc.l.push(parseInt(last));
      return acc;
    }, { f: [], l: [] });
  return [...f, ...l];
}
