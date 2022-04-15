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

async function getHistoryFromSheet() {
  const { f, l } = (await getSheetData(ROOSELETTE_SPREADSHEET_ID, hubRangeMap.hub_history))
    .reduce((acc, [first, last]) => {
      acc.f.push(parseInt(first));
      acc.l.push(parseInt(last));
      return acc;
    }, { f: [], l: [] });
  return [...f, ...l];
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

export async function screenshotAndReadHistory(num) {
  const directory = 'src/screenshots/history';
  const heightBuffer = parseInt(num) * 28;
  if (!session.pages.table) return;
  await session.pages.table.screenshot({
    path: `${directory}/${num}.png`,
    clip: { x: 1133, y: 79 + heightBuffer, width: 15, height: 11 }
  });

  const normal = (await tesseract.recognize(`${directory}/${num}-alt.png`, { oem: 3, psm: 8, tessedit_char_whitelist: "0123456789" })).replace('\n', '');
  return normal;
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
