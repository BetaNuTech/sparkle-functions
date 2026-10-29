const { expect } = require('chai');
const { countPendingItemUploads } = require('./inspection');

describe('Utils | Inspection | Count Pending Item Uploads', () => {
  it('returns zero for an inspection without template items', () => {
    const expected = 0;
    const actual = countPendingItemUploads({ template: { name: 'test' } });
    expect(actual).to.equal(expected);
  });

  it('returns zero when every photo and signature has a download URL', () => {
    const expected = 0;
    const actual = countPendingItemUploads(
      createInspection({
        one: {
          photosData: {
            1: { caption: '', downloadURL: 'https://test.com/1.jpg' },
            2: { caption: '', downloadURL: 'https://test.com/2.jpg' },
          },
        },
        two: {
          signatureTimestampKey: '1536244137184',
          signatureDownloadURL: 'https://test.com/sig.png',
        },
      })
    );
    expect(actual).to.equal(expected);
  });

  it('counts item photos with an empty download URL across all items', () => {
    const expected = 3;
    const actual = countPendingItemUploads(
      createInspection({
        one: {
          photosData: {
            1: { caption: '', downloadURL: '' },
            2: { caption: '', downloadURL: 'https://test.com/2.jpg' },
            3: { caption: 'no url attribute' },
          },
        },
        two: {
          photosData: {
            4: { downloadURL: '' },
          },
        },
      })
    );
    expect(actual).to.equal(expected);
  });

  it('counts a signature that has a timestamp key but no download URL', () => {
    const expected = 1;
    const actual = countPendingItemUploads(
      createInspection({
        one: {
          signatureTimestampKey: '1536244137184',
          signatureDownloadURL: '',
        },
        two: {
          signatureTimestampKey: '',
          signatureDownloadURL: '', // never signed
        },
      })
    );
    expect(actual).to.equal(expected);
  });

  it('ignores removed items and photo field value deletes', () => {
    const expected = 1;
    const actual = countPendingItemUploads(
      createInspection({
        one: null,
        two: {
          photosData: {
            1: {}, // field value delete
            2: null,
            3: { downloadURL: '' },
          },
        },
      })
    );
    expect(actual).to.equal(expected);
  });
});

function createInspection(items = {}) {
  return {
    inspectionCompleted: true,
    template: { name: 'test', items },
  };
}
