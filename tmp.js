import { initialize, session } from "./src/tables.js";


const clickLocation = {
  bottom: { x: 400, y: 420 },
  even: { x: 510, y: 420 },
  red: { x: 630, y: 420 },
  black: { x: 740, y: 420 },
  odd: { x: 850, y: 420 },
  top: { x: 960, y: 420 }
};

(async function () {
  await initialize();

  await clickTest();


}());

async function clickTest() {
  console.log('bottom')
  await session.pages.table.mouse.click(clickLocation.bottom.x, clickLocation.bottom.y);
  await wait(1000);
  console.log('even')
  await session.pages.table.mouse.click(clickLocation.even.x, clickLocation.even.y);
  await wait(1000);
  console.log('red')
  await session.pages.table.mouse.click(clickLocation.red.x, clickLocation.red.y);
  await wait(1000);
  console.log('black')
  await session.pages.table.mouse.click(clickLocation.black.x, clickLocation.black.y);
  await wait(1000);
  console.log('odd')
  await session.pages.table.mouse.click(clickLocation.odd.x, clickLocation.odd.y);
  await wait(1000);
  console.log('top')
  await session.pages.table.mouse.click(clickLocation.top.x, clickLocation.top.y);
  await wait(1000);
  return clickTest();
}

async function wait(ms = 500) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
