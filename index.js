import { CronJob } from 'cron';
import { collectScreenshots } from './images.js';
import redis from './redis.js';
import fs from 'fs';
import screenshot from 'screenshot-desktop';
import tesseract from 'node-tesseract-ocr';
import clipper from 'image-clipper';
import canvas from 'canvas';
clipper.configure('canvas', canvas);


async function run() {
  console.log('-----------------------');
  let ssCache = [
    { ss: await screenshot(), read: [] },
    { ss: await screenshot(), read: [] },
    { ss: await screenshot(), read: [] }
  ];
  ssCache.forEach(({ ss }, i) => fs.writeFileSync(`tmp/ss${i}.png`, ss));
  ssCache = await Promise.all(ssCache.map(async ({ ss }, i) => {
    clipper(`tmp/ss${i}.png`, function () {
      this.crop(1352, 488, 175, 125)
        .resize(80, 70)
        .quality(80)
        .toFile(`tmp/croppedA${i}.png`, () => { });
    });
    clipper(`tmp/ss${i}.png`, function () {
      this.crop(1385, 488, 120, 125)
        .resize(80, 70)
        .quality(80)
        .toFile(`tmp/croppedB${i}.png`, () => { });
    });
    clipper(`tmp/ss${i}.png`, function () {
      this.crop(1352, 488, 170, 110)
        .resize(140, 100)
        .quality(80)
        .toFile(`tmp/croppedC${i}.png`, () => { });
    });
    const readA = await tesseract.recognize(`tmp/croppedA${i}.png`, { lang: "eng", oem: 1, psm: 8 });
    const readB = await tesseract.recognize(`tmp/croppedB${i}.png`, { lang: "eng", oem: 1, psm: 8 });
    const readC = await tesseract.recognize(`tmp/croppedC${i}.png`, { lang: "eng", oem: 1, psm: 8 });
    return {
      ss,
      read: [parseInt(readA), parseInt(readB), parseInt(readC)]
    }
  }));
  await new Promise(resolve => setTimeout(resolve, 100));






  console.log(ssCache)

  // const historyHashPrevious = await redis.get('history_hash');
  // const current = (await tesseract.recognize("tmp/current.png", { lang: "eng", oem: 1, psm: 8 })).replace(/[()]/g, '').trim();
  // const historyHash = (await tesseract.recognize("tmp/history.png", { lang: "eng", oem: 1, psm: 8 })).replace(/ /g, '');

  // if (historyHash === historyHashPrevious || !(historyHash[0] === '(' && historyHash.includes(')'))) {
  //   console.log('no change')
  //   return;
  // }
  // await redis.set('history_hash', historyHash);
  // // const currentActual = Number.isNaN(parseInt(current)) ? historyHash.split('(').pop().split(')')[0] : current;
  // console.log('>', current, '<', '  ', historyHash);

}

new CronJob('*/1 * * * * *', async function () {
  try {
    await run();
  } catch (err) {
    console.log(err);
  }
}, null, true, 'America/Chicago').start();

/*
0 = Orientation and script detection (OSD) only.
1 = Automatic page segmentation with OSD.
2 = Automatic page segmentation, but no OSD, or OCR. (not implemented)
3 = Fully automatic page segmentation, but no OSD. (Default)
4 = Assume a single column of text of variable sizes.
5 = Assume a single uniform block of vertically aligned text.
6 = Assume a single uniform block of text.
7 = Treat the image as a single text line.
8 = Treat the image as a single word.
9 = Treat the image as a single word in a circle.
10 = Treat the image as a single character.
11 = Sparse text. Find as much text as possible in no particular order.
12 = Sparse text with OSD.
13 = Raw line. Treat the image as a single text line,
     bypassing hacks that are Tesseract-specific.
*/

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}