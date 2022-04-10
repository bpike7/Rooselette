import { CronJob } from 'cron';
import { login, openNewTablePage, betLoop } from './modules/puppeteer.js';
import updateHistory from './history.js';
import axios from 'axios';
import handleBets from './bets.js'
import redis from './modules/redis.js';

const { NODE_ENV, APP_URL } = process.env;

(async function () {
  await login();
  await openNewTablePage();
  await redis.set('is_betting', false);
}());

new CronJob('*/5 * * * * *', async function () {
  // await axios.get(`${APP_URL}${NODE_ENV === 'development' ? `:${PORT}` : ''}/heartbeat`);
  try {
    const isBetting = await redis.get('is_betting');
    if (!isBetting) {
      // await reestablishTablePage();
      await updateHistory();
      await handleBets();
    }
  } catch (err) {
    console.log(err);
  }
}, null, true, 'America/Chicago').start();
