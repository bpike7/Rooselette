import { CronJob } from 'cron';
import { initialize } from './tables.js';
import run from './run.js';

const { NODE_ENV, APP_URL } = process.env;

// TODO - Figure out how to detect winnings

initialize();

new CronJob('*/10 * * * * *', async function () {
  // await axios.get(`${APP_URL}${NODE_ENV === 'development' ? `:${PORT}` : ''}/heartbeat`);
  await run();
}, null, true, 'America/Chicago').start();
