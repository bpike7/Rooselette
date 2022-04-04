import { screenshotAndReadHistory } from './modules/puppeteer.js';

const misreads = {
  2: ['re'],
  3: ['PS'],
  5: ['iny', 'ay', 'iy', '>'],
  7: ['ae', 'Pe'],
  8: ['be'],
  9: ['ach'],
  11: ['mie'],
  13: ['mic}'],
  16: ['mis}', 'mie}'],
  17: ['V7'],
  27: ['al'],
  29: ['45)'],
  35: ['be']
};

export default async function () {
  const recentHistory = await getLastXNumbers(5);
  console.log(recentHistory);
}

async function getLastXNumbers(x) {
  return Promise.all([...Array(x)].map((_, i) => i).map(async num => {
    const read = await screenshotAndReadHistory(num);
    const readParsed = Number.isNaN(parseInt(read)) ? findMisread(read, num) : read;
    const readChecked = validateAgainstKnownFalsePositives(readParsed);
    console.log(`${num}: ${readChecked}`);
    return readChecked;
  }));
}



function validateAgainstKnownFalsePositives(read, num) {
  if (read === 27) console.log(`${num} could be a misread!: ${read}`);
  if (read === 7) console.log(`${num} could be a misread!: ${read}`);
  return read;
}

function findMisread(read, num) {
  const misread = Object.entries(misreads).find(([_, misreadings]) => misreadings.includes(read));
  if (!misread) throw Error(`could not find misread for ${num}:${read}`);
  return misread[0];
}
