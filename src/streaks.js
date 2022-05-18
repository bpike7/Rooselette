const numbers = {
  '1/2': {
    red_black: {
      red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
    },
    even_odd: {
      even: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
      odd: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35]
    },
    top_bottom: {
      top: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
      bottom: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
    },
  },
  // '1/3': {
  //   small_medium_big: {
  //     small: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  //     medium: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  //     big: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]
  //   },
  //   top_middle_bottom: {
  //     top: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  //     middle: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  //     bottom: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
  //   }
  // }
}

const patterns = [
  { id: 'SINGLE', pattern: 'A' },
  { id: 'ALTERNATING', pattern: 'AB' },
  // { id: 'THIRD_WHEEL', pattern: 'AAB' },
  // { id: 'TRIPS_ONE_OUT', pattern: 'AAAB' },
  // { id: 'DOUBLE_DATE', pattern: 'AABB' },
];


export default function (history) {
  const immutableHistory = [...history];
  immutableHistory.reverse()
  const halfPoints = evalHalfpoints(immutableHistory);
  return halfPoints.filter(s => !!s).sort((a, b) => a.streak < b.streak ? -1 : 1)
}

function evalHalfpoints(history, attempts = 0) {
  if (attempts > 2) return [];
  attempts += 1;
  const streaks = patterns.map(({ id, pattern }) => {
    return Object.entries(numbers['1/2']).map(([typeDefinition, types]) => {
      return Object.entries(types).map(([type, n]) => {
        const { streak, patternIndex } = matchPatterns(pattern, n, history);
        return {
          type: typeDefinition,
          patternId: id,
          pattern: pattern.split('').map(p => p === 'A' ? type : typeDefinition.split('_').filter(t => t !== type)[0]),
          nextInPatternIndex: patternIndex,
          streak
        };
      }).filter(({ streak, pattern }) => streak >= pattern.length * 2 + 1)
    }).filter(s => s.length > 0).flat();
  }).filter(s => s.length > 0).flat();
  if (streaks.length === 0) {
    history.shift();
    return evalHalfpoints(history, attempts);
  }
  return streaks;
}

function matchPatterns(pattern, n, history) {
  const patternSplit = pattern.split('');
  let patternIndex = 0;
  let streak = 0;
  history.forEach(h => {
    if (patternSplit[patternIndex] === 'A' && n.includes(h)) streak += 1;
    else if (patternSplit[patternIndex] === 'B' && !n.includes(h)) streak += 1;
    else streak = 0;

    if (patternIndex === patternSplit.length - 1) {
      patternIndex = 0;
    }
    else patternIndex += 1;
  });
  return { streak, patternIndex };
}
