const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
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
    const result = forkTemplate('1', srcTemplate);
    const sections = (result || {}).sections || {};
    const actual = Object.values(sections)
      .sort((a, b) => a.index - b.index)
      .map(section => {
        delete section.clone; // tested separately
        return JSON.stringify(section);
      });

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
    const result = forkTemplate('1', srcTemplate);
    const items = (result || {}).items || {};
    const actual = Object.values(items)
      .sort((a, b) => a.index - b.index)
      .map(item => {
        delete item.clone; // tested separately
        return JSON.stringify(item);
      });

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
    const result = forkTemplate('1', srcTemplate);
    const items = (result || {}).items || {};
    const actual = Object.values(items).map(item => item.version);

    expect(actual).to.deep.equal(expected);
  });

  it('it sets a clone reference in template, sections, and items', () => {
    const templateId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const expected = [templateId, sectionId, itemId];
    const section = mocking.createSection();
    const item = mocking.createItem({
      index: 0,
      sectionId,
    });
    const srcTemplate = mocking.createTemplate({
      sections: {
        [sectionId]: section,
      },
      items: {
        [itemId]: item,
      },
    });
    const result = forkTemplate(templateId, srcTemplate) || {};
    const [resultItem] = Object.values(result.items || {});
    const [resultSection] = Object.values(result.sections || {});

    const actual = [result.clone, resultSection.clone, resultItem.clone];
    expect(actual).to.deep.equal(expected);
  });
});
