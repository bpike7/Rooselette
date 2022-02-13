import fs from 'fs';
import screenshot from 'screenshot-desktop';
import tesseract from 'node-tesseract-ocr';
import clipper from 'image-clipper';
import canvas from 'canvas';
clipper.configure('canvas', canvas);

export async function collectScreenshots() {
  const img = await screenshot();
  fs.writeFileSync(`tmp/screenshot.png`, img);
  clipper('tmp/screenshot.png', function () {
    this.crop(1352, 488, 175, 125)
      .resize(80, 70)
      .quality(80)
      .toFile('tmp/just-landed.png', () => { })
  });
  await new Promise(resolve => setTimeout(resolve, 100));


}


  // clipper('tmp/screenshot.png', function () {
  //   this.crop(1563, 425, 94, 60)
  //     .resize(50, 30)
  //     .quality(80)
  //     .toFile('tmp/current.png', () => { })
  // });
  // clipper('tmp/screenshot.png', function () {
  //   this.crop(1570, 429, 1000, 55)
  //     .resize(800, 50)
  //     .quality(80)
  //     .toFile('tmp/history.png', () => { })
  // });
