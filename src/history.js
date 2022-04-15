import { screenshotTableHistory } from './modules/puppeteer.js';
import { getAverageColor } from 'fast-average-color-node';
import redis from './modules/redis.js';


export default async function () {
  const historyColors = await getLastXColors(10);
  if (historyColors.every((val, _, arr) => val === arr[0])) return redis.set('history_colors', []);
  await redis.set('history_colors', historyColors);
}

async function getLastXColors(x) {
  return (await Promise.all([...Array(x)].map((_, i) => i).map(async n => {
    const buffer = await screenshotTableHistory(n);
    if (!buffer) return;
    const color = await getAverageColor(buffer, { ignoredColor: [255, 255, 255, 255] });
    return resolveColor(color.value);
  })));
}

function resolveColor([r, g, b, a]) {
  if (r >= 94 && r <= 96 && g >= 170 && g <= 174) return 'green';
  else if (r > 165) return 'red';
  else return 'black';
}
