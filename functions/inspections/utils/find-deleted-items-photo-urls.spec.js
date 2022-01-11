const { expect } = require('chai');
const mocking = require('../../test-helpers/mocking');
const uuid = require('../../test-helpers/uuid');
const findAll = require('./find-deleted-items-photo-urls');

describe('Unit | Inspections | Utils | Find Delete Item Photo Urls', () => {
  it('returns an empty result when no items deleted', async () => {
    const expected = [];
    const inspection = mocking.createInspection({ property: uuid() });
    const updates = {};
    const actual = findAll(inspection, updates);
    expect(actual).to.deep.equal(expected);
  });

  it('returns an empty result when deleted items do not exist', async () => {
    const expected = [];
    const inspection = mocking.createInspection({ property: uuid() });
    const updates = {
      template: {
        items: {
          doesNotExist: null,
        },
      },
    };
    const actual = findAll(inspection, updates);
    expect(actual).to.deep.equal(expected);
  });

  it('returns an empty result when deleted items photos are missing a download URL', async () => {
    const expected = [];
    const inspection = mocking.createInspection({
      property: uuid(),
      template: {
        one: mocking.createItem({
          sectionId: uuid(),
          photosData: {
            title: 'missing download url',
          },
        }),
      },
    });
    const updates = {
      template: {
        items: {
          one: null,
        },
      },
    };
    const actual = findAll(inspection, updates);
    expect(actual).to.deep.equal(expected);
  });

  it('returns all deleted items id and photo URLs', async () => {
    const itemOneId = uuid();
    const itemTwoId = uuid();
    const itemThreeId = uuid();
    const urlOne = 'google.com/pic.jpg';
    const urlTwo = 'twitter.com/pic.jpg';
    const urlThree = 'geocities.com/pic.jpg';
    const expected = [
      { item: itemOneId, url: urlOne },
      { item: itemTwoId, url: urlTwo },
      { item: itemThreeId, url: urlThree },
    ].sort();
    const deletedSectionOneId = uuid();
    const deletedSectionTwoId = uuid();
    const normalSectionThreeId = uuid();
    const inspection = mocking.createInspection({
      property: uuid(),
      template: {
        sections: {
          [deletedSectionOneId]: mocking.createSection(),
          [deletedSectionTwoId]: mocking.createSection(),
          [normalSectionThreeId]: mocking.createSection(),
        },
        items: {
          [itemOneId]: mocking.createItem({
            sectionId: deletedSectionOneId,
            photosData: {
              [uuid()]: mocking.createInspectionItemPhotoData({
                downloadURL: urlOne,
              }),
            },
          }),
          [itemTwoId]: mocking.createItem({
            sectionId: deletedSectionOneId,
            photosData: {
              [uuid()]: mocking.createInspectionItemPhotoData({
                downloadURL: urlTwo,
              }),
            },
          }),
          [itemThreeId]: mocking.createItem({
            sectionId: deletedSectionTwoId,
            photosData: {
              [uuid()]: mocking.createInspectionItemPhotoData({
                downloadURL: urlThree,
              }),
            },
          }),
          four: mocking.createItem({
            sectionId: normalSectionThreeId,
            photosData: {
              [uuid()]: mocking.createInspectionItemPhotoData(),
            },
          }),
        },
      },
    });
    const updates = {
      template: {
        sections: {
          [deletedSectionOneId]: null,
          [deletedSectionTwoId]: null,
        },
        items: {
          [itemOneId]: null,
          [itemTwoId]: null,
          [itemThreeId]: null,
        },
      },
    };
    const actual = findAll(inspection, updates).sort();
    expect(actual).to.deep.equal(expected);
  });
});
