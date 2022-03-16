const { expect } = require('chai');
const mocking = require('../../test-helpers/mocking');
const uuid = require('../../test-helpers/uuid');
const update = require('./update');
const deepClone = require('../../utils/deep-clone');

describe('Unit | Templates | Utils | Update', () => {
  it('applies all template updates', () => {
    const expected = {
      name: 'Updated',
      description: 'Description',
      category: '123',
      trackDeficientItems: false,
      requireDeficientItemNoteAndPhoto: false,
    };
    const template = mocking.createTemplate();
    const changes = { ...expected };

    // Assertions
    const actual = update(template, changes);
    delete actual.updatedAt;
    expect(actual).to.deep.equal(expected);
  });

  it('appends a new section', () => {
    const expected = 1;
    const origSectionId = uuid();
    const addedSectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [origSectionId]: mocking.createSection({
          title: 'Original',
          index: 0,
        }), // original section
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId: origSectionId,
        }),
      },
    });
    const changes = {
      sections: {
        [addedSectionId]: removeUneditable(
          mocking.createSection({
            index: 1,
            title: 'Added',
          })
        ),
      },
      items: {
        two: removeUneditable(
          mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: addedSectionId,
          })
        ),
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultSections = (result || {}).sections || {};
    const actual = Object.keys(resultSections).length;
    expect(actual).to.equal(expected);
  });

  it('adds default attributes to a new section', () => {
    const expected = {
      title: 'New',
      index: 0,
      section_type: 'multi',
      added_multi_section: false,
    };
    const sectionId = uuid();
    const template = mocking.createTemplate();
    const changes = {
      sections: {
        [sectionId]: {
          title: expected.title,
          index: expected.index,
          section_type: expected.section_type,
        },
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultSections = (result || {}).sections || {};
    const actual = resultSections[sectionId];
    expect(actual).to.deep.equal(expected);
  });

  it('updates an existing section', () => {
    const expected = { title: 'updated' };
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection({
          title: 'Old',
          index: 0,
        }),
      },
    });
    const changes = {
      sections: {
        [sectionId]: { title: expected.title },
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultSections = (result || {}).sections || {};
    const actual = resultSections[sectionId];
    expect(actual).to.deep.equal(expected);
  });

  it('appends new items', () => {
    const expected = 3;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
    });
    const changes = {
      items: {
        one: removeUneditable(
          mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
            index: 0,
          })
        ),
        two: removeUneditable(
          mocking.incompletedSignatureInputItem({
            sectionId,
            index: 1,
          })
        ),
        three: removeUneditable(
          mocking.incompletedTextInputItem({
            sectionId,
            index: 2,
          })
        ),
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultItems = (result || {}).items || {};
    const actual = Object.keys(resultItems).length;
    expect(actual).to.equal(expected);
  });

  it('adds default attributes to a new item', () => {
    const expected = false;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
    });
    const changes = {
      items: {
        one: removeUneditable(
          mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          })
        ),
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultItems = (result || {}).items || {};
    const actual = (resultItems.one || {}).isItemNA;
    expect(actual).to.equal(expected);
  });

  it('adds default attributes to main new item', () => {
    const expected = -1;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
    });
    const changes = {
      items: {
        one: removeUneditable(
          mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          })
        ),
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultItems = (result || {}).items || {};
    const actual = (resultItems.one || {}).mainInputSelection;
    expect(actual).to.equal(expected);
  });

  it('adds default attributes to text input new item', () => {
    const expected = true;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
    });
    const changes = {
      items: {
        one: removeUneditable(
          mocking.incompletedTextInputItem({
            sectionId,
          })
        ),
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultItems = (result || {}).items || {};
    const actual = (resultItems.one || {}).isTextInputItem;
    expect(actual).to.equal(expected);
  });

  it('transitions an item from main to text or signature', () => {
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
      },
    });

    const tests = [
      {
        data: deepClone(template),
        expected: { mainInputSelection: undefined, isTextInputItem: true },
        msg: 'transitioned to a text input item',
        change: {
          items: {
            one: { itemType: 'text_input' },
          },
        },
      },
      {
        data: deepClone(template),
        expected: { mainInputSelection: undefined, isTextInputItem: false },
        msg: 'transitioned to a signature item',
        change: {
          items: {
            one: { itemType: 'signature' },
          },
        },
      },
    ];

    // Assertions
    for (let i = 0; i < tests.length; i++) {
      const { data, msg, expected, change } = tests[i];
      const result = update(data, change);
      const resultItems = (result || {}).items || {};
      const resultItem = resultItems.one || {};
      const actual = {
        mainInputSelection: resultItem.mainInputSelection,
        isTextInputItem: resultItem.isTextInputItem,
      };
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('transitions a text item to main or signature', () => {
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.incompletedTextInputItem({
          sectionId,
        }),
      },
    });
    const tests = [
      {
        data: deepClone(template),
        expected: { mainInputSelection: -1, isTextInputItem: false },
        msg: 'transitioned to a main item',
        change: {
          items: {
            one: { itemType: 'main' },
          },
        },
      },
      {
        data: deepClone(template),
        expected: { mainInputSelection: undefined, isTextInputItem: false },
        msg: 'transitioned to a signature item',
        change: {
          items: {
            one: { itemType: 'signature' },
          },
        },
      },
    ];

    // Assertions
    for (let i = 0; i < tests.length; i++) {
      const { data, msg, expected, change } = tests[i];
      const result = update(data, change);
      const resultItems = (result || {}).items || {};
      const resultItem = resultItems.one || {};
      const actual = {
        mainInputSelection: resultItem.mainInputSelection,
        isTextInputItem: resultItem.isTextInputItem,
      };
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('transitions a signature item to main or text input item', () => {
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.incompletedSignatureInputItem({
          sectionId,
        }),
      },
    });
    const tests = [
      {
        data: deepClone(template),
        expected: { mainInputSelection: -1, isTextInputItem: false },
        msg: 'transitioned to a main item',
        change: {
          items: {
            one: { itemType: 'main' },
          },
        },
      },
      {
        data: deepClone(template),
        expected: { mainInputSelection: undefined, isTextInputItem: true },
        msg: 'transitioned to a text input item',
        change: {
          items: {
            one: { itemType: 'text_input' },
          },
        },
      },
    ];

    // Assertions
    for (let i = 0; i < tests.length; i++) {
      const { data, msg, expected, change } = tests[i];
      const result = update(data, change);
      const resultItems = (result || {}).items || {};
      const resultItem = resultItems.one || {};
      const actual = {
        mainInputSelection: resultItem.mainInputSelection,
        isTextInputItem: resultItem.isTextInputItem,
      };
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('instantiates and increments item version', () => {
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.incompletedSignatureInputItem({ sectionId, version: 1 }),
        two: mocking.incompletedSignatureInputItem({
          sectionId,
          version: 2,
          index: 1,
        }),
      },
    });

    const tests = [
      {
        data: deepClone(template),
        expected: [0],
        msg: 'instantiates version on new item',
        change: {
          items: {
            three: removeUneditable(
              mocking.incompletedSignatureInputItem({
                sectionId,
                index: 2,
              })
            ),
          },
        },
      },
      {
        data: deepClone(template),
        expected: [2, 3],
        msg: 'increments existing item versions',
        change: {
          items: {
            one: { title: 'new title' },
            two: { title: 'new title' },
          },
        },
      },
    ];

    // Assertions
    for (let i = 0; i < tests.length; i++) {
      const { data, msg, expected, change } = tests[i];
      const result = update(data, change);
      const resultItems = (result || {}).items || {};
      const actual = Object.values(resultItems)
        .sort((a, b) => a.index - b.index)
        .map(({ version }) => version);
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('sets a new updated at time', () => {
    const expected = Math.round(Date.now() / 1000);
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
      },
    });

    const result = update(
      template,
      {
        items: {
          one: {
            mainInputSelected: true,
            mainInputSelection: 0,
          },
        },
      },
      expected
    );
    const actual = result.updatedAt;
    expect(actual).to.equal(expected);
  });

  it('sets a completed at timestamp only when template is eligible', () => {
    const now = Math.round(Date.now() / 1000);

    const tests = [
      {
        expected: undefined,
        data: mocking.createTemplate({
          sections: {
            one: mocking.createSection(),
          },
        }),
        msg: 'does not complete template for adding second section',
        change: {
          sections: {
            two: removeUneditable(mocking.createSection({ index: 1 })),
          },
        },
      },
      {
        expected: undefined,
        data: mocking.createTemplate({
          sections: {
            one: mocking.createSection(),
          },
        }),
        msg: 'does not complete template for updating an existing section',
        change: {
          sections: {
            one: { title: 'updated' },
          },
        },
      },
      {
        expected: undefined,
        data: mocking.createTemplate({
          completedAt: 1,
          sections: {
            one: mocking.createSection(),
          },
          items: {
            itemOne: mocking.createIncompleteMainInputItem(
              'twoactions_checkmarkx',
              {
                sectionId: 'one',
              }
            ),
          },
        }),
        msg: 'does not complete template when already complete',
        change: {
          items: {
            itemTwo: removeUneditable(
              mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
                sectionId: 'one',
                index: 1,
              })
            ),
          },
        },
      },
      {
        expected: now,
        data: mocking.createTemplate({
          sections: {
            deleteMe: mocking.createSection(),
          },
        }),
        msg: 'completes a qualifying template',
        change: {
          sections: {
            one: removeUneditable(mocking.createSection({ index: 1 })),
            deleteMe: null, // Remove original section
          },
          items: {
            itemOne: removeUneditable(
              mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
                sectionId: 'two',
              })
            ),
          },
        },
      },
    ];

    // Assertions
    for (let i = 0; i < tests.length; i++) {
      const { data, msg, expected, change } = tests[i];
      const result = update(data, change, now);
      const actual = result.completedAt;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('removes a deleted section', () => {
    const expected = null;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
    });
    const changes = {
      sections: {
        [sectionId]: null,
      },
    };

    // Assertions
    const result = update(template, changes);
    const resultSections = (result || {}).sections || {};
    const actual = resultSections[sectionId];
    expect(actual).to.equal(expected);
  });

  it("removes a deleted section's items", () => {
    const expected = [null, null];
    const sectionId = uuid();
    const removedSectionId = uuid();
    const inspection = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection({ index: 0 }), // original section
        [removedSectionId]: mocking.createSection({ index: 1 }),
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
        two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId: removedSectionId,
        }),
        three: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId: removedSectionId,
        }),
      },
    });
    const changes = {
      sections: {
        [removedSectionId]: null,
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const resultItems = (result || {}).items || {};
    const actual = [resultItems.two, resultItems.three];
    expect(actual).to.deep.equal(expected);
  });

  it('removes a deleted item', () => {
    const expected = null;
    const sectionId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
      },
    });
    const changes = { items: { one: null } };

    // Assertions
    const result = update(template, changes);
    const resultItems = (result || {}).items || {};
    const actual = resultItems.one;
    expect(actual).to.equal(expected);
  });
});

/**
 * Remove all attributes of sections
 * and items that users of the PATCH
 * template endpoint are not allowed
 * to provide and should not be set
 * @param  {Object} src - section or item
 * @return {Object}
 */
function removeUneditable(src) {
  const result = JSON.parse(JSON.stringify(src || {}));
  delete result.added_multi_section;
  delete result.deficient;
  delete result.isItemNA;
  delete result.isTextInputItem;
  delete result.textInputValue;
  delete result.mainInputNotes;
  delete result.inspectorNotes;
  delete result.signatureDownloadURL;
  delete result.signatureTimestampKey;
  delete result.mainInputSelected;
  delete result.mainInputSelection;
  delete result.adminEdits;
  delete result.photosData;
  delete result.version;
  return result;
}
