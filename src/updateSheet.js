import { hubRangeMap, writeToSheet } from './googleSheets.js';

const { ROOSELETTE_SPREADSHEET_ID } = process.env;

(async function () {
  await randomizeHistory();
}());

async function randomizeHistory() {
  const history = [...Array(20)].map(() => randomNumber(0, 36));
  const firstHalf = history.splice(0, 10);
  const final = firstHalf.map(num => ([num])).map((num, i) => ([num[0], history[i]]));
  await writeToSheet(ROOSELETTE_SPREADSHEET_ID, hubRangeMap.hub_history, final);
}

function randomNumber(min, max) {
  return Math.round(Math.random() * (max - min) + min);
} 
