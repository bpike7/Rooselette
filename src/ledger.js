import { getSheetData, writeToSheet, rangeMap } from './modules/googleSheets.js';
import { notifyLedgerChange } from './modules/slack.js';
const { ROOSELETTE_SPREADSHEET_ID } = process.env;

export async function addToLedger(lineItems = []) {
  if (lineItems.length === 0) return;
  notifyLedgerChange(JSON.stringify(lineItems));
  const existingRows = (await getSheetData(ROOSELETTE_SPREADSHEET_ID, rangeMap.ledger)).filter(row => !!row[1]).reverse();
  const newRows = lineItems.map(({ pattern, bet, streakOverThreshold, balanceNew, creditDebit }) => ([
    new Date(),
    pattern.map(p => convertType(p)).join(','),
    convertType(bet),
    streakOverThreshold,
    creditDebit,
    balanceNew
  ]))
  await writeToSheet(ROOSELETTE_SPREADSHEET_ID, rangeMap.ledger, [...existingRows, ...newRows].reverse());
}

function convertType(type) {
  switch (type) {
    case 'black': return 'B'
    case 'red': return 'R'
    case 'odd': return 'O'
    case 'even': return 'E'
    // case '': return 'L2'
    // case '': return 'H2'
    // case '': return 'L3'
    // case '': return 'M3'
    // case '': return 'H3'
    // case '': return 'LR3'
    // case '': return 'MR3'
    // case '': return 'HR3'
    default: return '';
  }
}