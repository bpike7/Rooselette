import { CronJob } from 'cron';
import { login, openNewTablePage } from './modules/puppeteer.js';
import updateHistory from './history.js';
import axios from 'axios';
import handleBets from './bets.js'

const { NODE_ENV, APP_URL } = process.env;

(async function () {
  await login();
  await openNewTablePage();
}());

new CronJob('*/20 * * * * *', async function () {
  // await axios.get(`${APP_URL}${NODE_ENV === 'development' ? `:${PORT}` : ''}/heartbeat`);
  try {
    // await reestablishTablePage();
    await updateHistory();
    await handleBets();
  } catch (err) {
    console.log(err);
  }
}, null, true, 'America/Chicago').start();
