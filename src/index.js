import { CronJob } from 'cron';
import { initialize, getTableStatus } from './tables.js';
import run from './run.js';
import redis from './modules/redis.js';

initialize();

console.log(`Streak threshold: ${process.env.STREAK_THRESHOLD_HALF}`);
console.log(`Rebet attempt cap: ${process.env.REBET_ATTEMPT_CAP}`);

new CronJob('*/3 * * * * *', async function () {
  // await axios.get(`${process.env.APP_URL}${process.env.NODE_ENV === 'development' ? `:${PORT}` : ''}/heartbeat`);
  const tableStatus = await getTableStatus();
  const previousTableStatus = await redis.get('table_status');
  await redis.set('table_status', tableStatus);
  if (tableStatus === previousTableStatus || tableStatus !== 'open') return;
  if (tableStatus === 'stale') console.log('TABLE IS STALE!!!');
  await run();
}, null, true, 'America/Chicago').start();
