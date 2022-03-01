const { expect } = require('chai');
const mocking = require('../../test-helpers/mocking');
const forkTemplate = require('./fork-template');

describe('Templates | Utils | Fork Template', () => {
  it('it replaces all section identifiers', () => {
    const sectionOne = mocking.createSection({ index: 0 });
    const sectionTwo = mocking.createSection({
      index: 1,
      added_multi_section: true,
    });
    const srcTemplate = mocking.createTemplate({
      sections: {
        one: sectionOne,
        two: sectionTwo,
      },
      items: {},
    });
    const expected = [JSON.stringify(sectionOne), JSON.stringify(sectionTwo)];
    const result = forkTemplate(srcTemplate);
    const sections = (result || {}).sections || {};
    const actual = Object.values(sections)
      .sort((a, b) => a.index - b.index)
      .map(section => JSON.stringify(section));

    expect(sections.one).to.equal(
      undefined,
      'removed old section one identifier'
    );
    expect(sections.two).to.equal(
      undefined,
      'removed old section two identifier'
    );
    expect(actual).to.deep.equal(
      expected,
      'successfully cloned section object'
    );
  });

  it('it replaces all item identifiers', () => {
    const itemOne = mocking.createItem({
      index: 0,
      sectionId: '1',
      version: 0,
    });
    const itemTwo = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { index: 1, sectionId: '1', version: 0 }
    );
    const srcTemplate = mocking.createTemplate({
      sections: {},
      items: {
        one: itemOne,
        two: itemTwo,
      },
    });
    const expected = [JSON.stringify(itemOne), JSON.stringify(itemTwo)];
    const result = forkTemplate(srcTemplate);
    const items = (result || {}).items || {};
    const actual = Object.values(items)
      .sort((a, b) => a.index - b.index)
      .map(item => JSON.stringify(item));

    expect(items.one).to.equal(undefined, 'removed old item one identifier');
    expect(items.two).to.equal(undefined, 'removed old item two identifier');
    expect(actual).to.deep.equal(
      expected,
      'successfully cloned section object'
    );
  });

  it('it resets all item versions to zero', () => {
    const itemOne = mocking.createItem({
      index: 0,
      sectionId: '1',
      version: 24,
    });
    const itemTwo = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { index: 1, sectionId: '1', version: 1 }
    );
    const srcTemplate = mocking.createTemplate({
      sections: {},
      items: {
        one: itemOne,
        two: itemTwo,
      },
    });
    const expected = [0, 0];
    const result = forkTemplate(srcTemplate);
    const items = (result || {}).items || {};
    const actual = Object.values(items).map(item => item.version);

    expect(actual).to.deep.equal(
      expected,
      'successfully cloned section object'
    );
  });
});
