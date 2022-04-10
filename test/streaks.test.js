const resolveStreaks = require('../inworks/streaks.js');
const chai = require('chai');

describe('streaks', () => {
  it('Red', () => {
    const streak = resolveStreaks([1, 1, 23, 1, 1, 1, 1, 1]);
    const found = streak.find(s =>
      s.type === 'red_black' &&
      s.pattern[s.nextInPatternIndex] === 'red' &&
      s.streak === 8
    );
    chai.expect(found).to.not.equal(undefined, 'Expected streak was not found');
  });

  it('Black, bottom half, and even', () => {
    const streak = resolveStreaks([2, 2, 2, 2, 2, 2, 2, 2]);
    const foundColor = streak.find(s =>
      s.type === 'red_black' &&
      s.pattern[s.nextInPatternIndex] === 'black' &&
      s.streak === 8
    );
    const foundEven = streak.find(s =>
      s.type === 'even_odd' &&
      s.pattern[s.nextInPatternIndex] === 'even' &&
      s.streak === 8
    );
    const foundLower = streak.find(s =>
      s.type === 'top_bottom' &&
      s.pattern[s.nextInPatternIndex] === 'bottom' &&
      s.streak === 8
    );
    chai.expect(foundColor).to.not.equal(undefined, 'Expected streak was not found');
    chai.expect(foundEven).to.not.equal(undefined, 'Expected streak was not found');
    chai.expect(foundLower).to.not.equal(undefined, 'Expected streak was not found');
  });

  it('Alternating red, black', () => {
    const streak = resolveStreaks([1, 2, 1, 2, 1, 2, 1, 2]);
    const found = streak.find(s =>
      s.type === 'red_black' &&
      s.pattern[s.nextInPatternIndex] === 'black' &&
      s.streak === 8
    );
    chai.expect(found).to.not.equal(undefined, 'Expected streak was not found');
  });

  it('High Low Low', () => {
    const streak = resolveStreaks([2, 33, 2, 1, 33, 1, 2, 33]);
    const found = streak.find(s =>
      s.type === 'top_bottom' &&
      s.pattern[s.nextInPatternIndex] === 'bottom' &&
      s.streak === 8
    );
    chai.expect(found).to.not.equal(undefined, 'Expected streak was not found');
  });
});