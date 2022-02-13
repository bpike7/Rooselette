import fs from 'fs';
import clipper from 'image-clipper';
import canvas from 'canvas';
import tesseract from 'node-tesseract-ocr';
clipper.configure('canvas', canvas);

const board = ['00', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];


(async function () {
  const samples = fs.readdirSync('tmp/samples');
  samples.forEach(fileName => {
    clipper(`tmp/samples/${fileName}`, function () {
      this.crop(1375, 495, 130, 115)
        .resize(90, 70)
        .quality(80)
        .toFile(`tmp/samples-output/${fileName}`, () => { })
    });
  });

  await new Promise(resolve => setTimeout(resolve, 100))

  const samplesOutput = fs.readdirSync('tmp/samples-output');
  for (const fileName of samplesOutput) {
    console.log('----------------', fileName);
    const justLanded = await tesseract.recognize(`tmp/samples-output/${fileName}`, { lang: "eng", oem: 1, psm: 8 });
    const number = parseInt(justLanded);
    console.log(fileName, '->', number);
    if (board.includes(number)) continue;

    console.log('retrying', fileName)
    clipper(`tmp/samples/${fileName}`, function () {
      this.crop(1365, 495, 150, 115)
        .resize(90, 70)
        .quality(80)
        .toFile(`tmp/samples-output2/${fileName}`, () => { })
    });
    await new Promise(resolve => setTimeout(resolve, 100))
    const fixed1 = await tesseract.recognize(`tmp/samples-output2/${fileName}`, { lang: "eng", oem: 1, psm: 7 });
    const numberFixed1 = parseInt(fixed1);
    console.log(fileName, fixed1, 'FIX->', numberFixed1);
  }
}())