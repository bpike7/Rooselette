import { collectScreenshots } from './images.js';
import redis from '../src/modules/redis.js';
import fs from 'fs';
import tesseract from 'node-tesseract-ocr';
import clipper from 'image-clipper';
import canvas from 'canvas';
import { session, login, openNewTablePage } from '../src/modules/puppeteer.js';
clipper.configure('canvas', canvas);

const ssInterval = 500;

export default async function () {
  await login();
  await openNewTablePage();
}

async function loopTableReading() {
  await wait(ssInterval);

  const dir = 'screenshots/current';
  await session.pages.table.screenshot({ path: `${dir}/full.png` });
  clipper(`${dir}/full.png`, function () {
    this.crop(290, 214, 39, 22)
      .resize(70, 50)
      .quality(100)
      .toFile(`${dir}/cropped.png`, () => { });
  });
  await wait(100);
  const read = parseInt(await tesseract.recognize(`${dir}/cropped.png`, { lang: "eng", oem: 1, psm: 8 }));
  if (!fs.existsSync(`screenshots/numeric/${read}`) && read !== NaN) {
    fs.mkdirSync(`screenshots/numeric/${read}`);
    fs.mkdirSync(`screenshots/numeric-full/${read}`);
  }
  if (!isNaN(read)) await handleRead(dir, read);
  else {
    const expirationRead = await tesseract.recognize(`${dir}/full.png`, { lang: "eng", oem: 1, psm: 6 });
    if (expirationRead) {
      try {
        await session.pages.table.click('#general-error-lobby > div');
      } catch (err) {
        return loopTableReading();
      }
      return watchTable();
    }
  }
  return loopTableReading();
}

let lastReadTS;

async function handleRead(dir, read) {
  read = transformKnownMisreads(read);
  read = read.toString().length > 1 && read[0]
  // const timeBetweenReadsArray = (await redis.get('time_between_reads')) || [];
  const now = Date.now();
  if (!lastReadTS) lastReadTS = now
  const timeBetween = now - lastReadTS;
  console.log(timeBetween);

  console.log('New read!: ', read);
  fs.copyFileSync(`${dir}/cropped.png`, `screenshots/numeric/${read}/${Date.now()}.png`);
  fs.copyFileSync(`${dir}/full.png`, `screenshots/numeric-full/${read}/${Date.now()}.png`);
}

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function transformKnownMisreads(read) {
  const length = read.toString().length;
  if (length > 2 && read === 381) return 31;
  return read;
}


// /*
// 0 = Orientation and script detection (OSD) only.
// 1 = Automatic page segmentation with OSD.
// 2 = Automatic page segmentation, but no OSD, or OCR. (not implemented)
// 3 = Fully automatic page segmentation, but no OSD. (Default)
// 4 = Assume a single column of text of variable sizes.
// 5 = Assume a single uniform block of vertically aligned text.
// 6 = Assume a single uniform block of text.
// 7 = Treat the image as a single text line.
// 8 = Treat the image as a single word.
// 9 = Treat the image as a single word in a circle.
// 10 = Treat the image as a single character.
// 11 = Sparse text. Find as much text as possible in no particular order.
// 12 = Sparse text with OSD.
// 13 = Raw line. Treat the image as a single text line,
//      bypassing hacks that are Tesseract-specific.
// */
