import { screenshotTableHistory } from './modules/puppeteer.js';
import { getAverageColor } from 'fast-average-color-node';
import tesseract from 'node-tesseract-ocr';
import redis from './modules/redis.js';

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
  const historyColors = await getLastXColors(10);
  await redis.set('history_colors', historyColors);
}

async function getLastXColors(x) {
  return (await Promise.all([...Array(x)].map((_, i) => i).map(async n => {
    const buffer = await screenshotTableHistory(n);
    const color = await getAverageColor(buffer, { ignoredColor: [255, 255, 255, 255] });
    // const read = (await tesseract.recognize(`src/screenshots/history/${n}.png`, { oem: 3, psm: 8, tessedit_char_whitelist: "0123456789" })).replace('\n', '');
    return resolveColor(color.value);
  })));
}

function resolveColor([r, g, b, a]) {
  if (r >= 94 && r <= 96 && g >= 170 && g <= 174) return 'green';
  else if (r > 165) return 'red';
  else return 'black';
}

async function getLastXNumbers(x) {
  return Promise.all([...Array(x)].map((_, i) => i).map(async num => {
    const read = await screenshotAndReadHistory(num);
    const readParsed = Number.isNaN(parseInt(read)) ? findMisread(read, num) : read;
    const readChecked = validateAgainstKnownFalsePositives(readParsed);
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

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}