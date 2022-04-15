import redis from './modules/redis.js';
import getStreaksFromHistoryColors from './streaksColors.js';
import { betLoop } from './modules/puppeteer.js';
import * as Slack from './modules/slack.js';

const {
  STREAK_THRESHOLD_HALF,
  BET_SIZE = 5
} = process.env;


export default async function () {
  console.log('---------------------')
  await redis.set('is_betting', true);
  const history = (await redis.get('history_colors')).map(c => c === 'red' ? 1 : c === 'black' ? 2 : 0);
  const streaks = getStreaksFromHistoryColors(history);
  // TODO - do not allow bets on multiple patterns of same type
  const streaksPrioritized = [streaks.sort((a, b) => a.streak < b.streak ? -1 : 1)[0]].filter(s => !!s);
  console.log(streaksPrioritized.map(({ pattern, streak }) => ({ pattern, streak })));
  const bets = convertStreaksToBets(streaksPrioritized);
  console.log(bets);
  for (const betInfo of bets) {
    await betLoop(betInfo);
  }
  await redis.set('is_betting', false);
}

function convertStreaksToBets(streaks) {
  return streaks
    .filter(({ streak }) => streak >= parseInt(STREAK_THRESHOLD_HALF) && streak < 9)
    .map(({ type, pattern, nextInPatternIndex, streak }) => {
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
