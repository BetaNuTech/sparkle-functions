const { expect } = require('chai');
const create = require('./create-item-photo-data-id');

describe('Inspection | Utils | Create Item Photo Data ID', () => {
  it('creates a first photo data entry for an item and the current unix time', () => {
    const now = Math.round(Date.now() / 1000);
    const expected = `${now}`.slice(0, -1); // ignore last second to avoid race conditions
    const actual = `${create() || ''}`.slice(0, -1);
    expect(actual).to.equal(expected);
  });

  it('always creates a unique photo data item ID under a unique unix timestamp', () => {
    const photosData = {};
    const now = Math.round(Date.now() / 1000);
    let expected = now;

    for (let i = 0; i < 4; i += 1) {
      const photoDataEntry = {
        caption: `${i}`,
        downloadURL: 'url.com/img.jpg',
      };
      photosData[`${now + i}`] = photoDataEntry;
      expected += 1;
    }

    const actual = create(photosData);
    expect(actual).to.equal(`${expected}`);
  });
});
