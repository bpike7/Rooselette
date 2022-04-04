import redis from './modules/redis.js';
import { } from './modules/puppeteer.js';
import resolveStreaks from './streaks.js';
import { getSheetData, hubRangeMap } from './modules/googleSheets.js';


const { ROOSELETTE_SPREADSHEET_ID } = process.env;


// TODO fix - red for some reason is coming in as 11 streak length


(async function () {
  const { f, l } = (await getSheetData(ROOSELETTE_SPREADSHEET_ID, hubRangeMap.hub_history))
    .reduce((acc, [first, last]) => {
      acc.f.push(parseInt(first));
      acc.l.push(parseInt(last));
      return acc;
    }, { f: [], l: [] });

  const history = [...f, ...l];
  console.log(history)
  const streaks = resolveStreaks(history);
  console.log(streaks);
  // const bets = resolveBets(streaks);
}());

function resolveBets() {

}