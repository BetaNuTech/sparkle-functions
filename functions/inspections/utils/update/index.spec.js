const { expect } = require('chai');
const config = require('../../../config');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const update = require('./index');

const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;

describe('Unit | Inspections | Utils | Update', () => {
  it('appends a new multi section', () => {
    const expected = 1;
    const propertyId = uuid();
    const origSectionId = uuid();
    const addedSectionId = uuid();
    const sectionConfig = { title: 'Multi', section_type: 'multi' };
    const inspection = mocking.createInspection({
      property: propertyId,
      totalItems: 0,
      template: {
        sections: {
          [origSectionId]: mocking.createSection(sectionConfig), // original section
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: origSectionId,
          }),
        },
      },
    });
    const changes = {
      sections: {
        [addedSectionId]: mocking.createSection({
          ...sectionConfig,
          index: 1,
          added_multi_section: true,
        }),
      },
      items: {
        two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId: addedSectionId,
        }),
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const resultSections = (result.template || {}).sections || {};
    const actual = Object.keys(resultSections).length;
    expect(actual).to.equal(expected);
  });

  it('appends new multi section associated items', () => {
    const expected = 1;
    const propertyId = uuid();
    const origSectionId = uuid();
    const addedSectionId = uuid();
    const sectionConfig = { title: 'Multi', section_type: 'multi' };
    const inspection = mocking.createInspection({
      property: propertyId,
      totalItems: 0,
      template: {
        sections: {
          [origSectionId]: mocking.createSection(sectionConfig), // original section
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: origSectionId,
          }),
        },
      },
    });
    const changes = {
      sections: {
        [addedSectionId]: mocking.createSection({
          ...sectionConfig,
          index: 1,
          added_multi_section: true,
        }),
      },
      items: {
        two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId: addedSectionId,
        }),
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const resultItems = (result.template || {}).items || {};
    const actual = Object.keys(resultItems).length;
    expect(actual).to.equal(expected);
  });

  it('sets total items in the inspections', () => {
    const expected = 2;
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      totalItems: 0,
      template: {
        sections: {},
        items: {},
      },
    });
    const changes = {
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
        two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
          sectionId,
        }),
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const actual = result.totalItems;
    expect(actual).to.equal(expected);
  });

  it('it sets the items completed count', () => {
    const expected = 3;
    const propertyId = uuid();
    const sectionId = uuid();
    const incompleteItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      {
        sectionId: '1',
      }
    );
    const inspection = mocking.createInspection({
      property: propertyId,
      template: {
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: incompleteItem,
          two: incompleteItem,
          three: incompleteItem,
          four: incompleteItem,
        },
      },
    });
    const userUpdates = {
      items: {
        one: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
        two: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
        four: {
          isItemNA: true,
        },
      },
    };

    const result = update(inspection, userUpdates);
    const actual = result.itemsCompleted;
    expect(actual).to.equal(expected);
  });

  it('it completes inspection when all applicable items are completed', () => {
    const expected = true;
    const propertyId = uuid();
    const sectionId = uuid();

    // Non deficient list eligible valid item
    const inspection = mocking.createInspection({
      property: propertyId,
      template: {
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
        },
      },
    });
    const userUpdates = {
      items: {
        one: {
          isItemNA: true,
        },
      },
    };

    const result = update(inspection, userUpdates);
    const actual = result.inspectionCompleted;
    expect(actual).to.equal(expected);
  });

  it('it only completes inspection when all deficient list eligible, note enabled, items have an inspector note', () => {
    const mainInputSelected = true;
    const photosData = { one: {} }; // truthy photo data
    const propertyId = uuid();
    const sectionId = uuid();
    const tests = [].concat(
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType => {
        const deficientEligibleSelection = DEFICIENT_ITEM_ELIGIBLE[
          mainInputType
        ].indexOf(true);
        return [
          {
            expected: false,
            inspectionData: {
              itemsCompleted: 1,
              inspectionCompleted: true, // must be previously completed
            },
            data: {
              mainInputType,
              photosData,
              notes: true,
            },
            userUpdate: {
              inspectorNotes: '', // no inspector note
              mainInputSelected,
              mainInputSelection: deficientEligibleSelection,
            },
            msg: `${mainInputType} item with notes enabled
        and without an inspector note did not complete inspection`,
          },
          {
            expected: true,
            data: {
              mainInputType,
              photosData,
              notes: false, // notes disabled
            },
            userUpdate: {
              inspectorNotes: '',
              mainInputSelected,
              mainInputSelection: deficientEligibleSelection,
            },
            msg: `${mainInputType} item with notes disabled
        and without an inspector note did complete inspection`,
          },
          {
            expected: true,
            data: {
              photosData,
              notes: true, // notes enabled
            },
            userUpdate: {
              mainInputSelected,
              mainInputSelection: deficientEligibleSelection,
              inspectorNotes: 'note', // has inspector note
            },
            msg: `${mainInputType} item with notes enabled
        and with an inspector note did complete inspection`,
          },
        ];
      })
    );

    for (let i = 0; i < tests.length; i++) {
      const { expected, inspectionData = {}, data, userUpdate, msg } = tests[i];
      const inspection = mocking.createInspection({
        property: propertyId,
        template: {
          requireDeficientItemNoteAndPhoto: true,
          sections: {
            [sectionId]: mocking.createSection(),
          },
          items: {
            one: mocking.createIncompleteMainInputItem(
              'twoactions_checkmarkx',
              {
                ...data,
                sectionId,
              }
            ),
          },
        },
        ...inspectionData,
      });

      const result = update(inspection, { items: { one: userUpdate } });
      const actual = result.inspectionCompleted;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('should count all deficient eligible, applicable, items in the template', () => {
    const propertyId = uuid();
    const sectionId = uuid();
    const mainInputSelected = true;

    const tests = [].concat(
      // Missing notes & photos
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((isDeficient, i) => ({
          expected: !isDeficient,
          data: {
            mainInputType,
            photos: true,
            notes: true,
          },
          userUpdate: {
            mainInputSelection: i,
            mainInputSelected,
            inspectorNotes: '',
            photosData: null,
          },
        }))
      ),

      // Missing photos
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((isDeficient, i) => ({
          expected: !isDeficient,
          data: {
            mainInputType,
            photos: true,
            notes: false,
          },
          userUpdate: {
            photosData: null,
            mainInputSelection: i,
            mainInputSelected,
          },
        }))
      ),

      // Missing notes
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((isDeficient, i) => ({
          expected: !isDeficient,
          data: {
            mainInputType,
            photos: false,
            notes: true,
          },
          userUpdate: {
            inspectorNotes: '',
            mainInputSelection: i,
            mainInputSelected,
          },
        }))
      ),

      // Deficient items set to NA
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((_, i) => ({
          expected: true,
          data: {
            mainInputType,
            notes: true,
            photos: true,
          },
          userUpdate: {
            isItemNA: true,
            inspectorNotes: '',
            photosData: null,
            mainInputSelection: i,
            mainInputSelected,
          },
        }))
      ),

      // Meet requirements w/ only photos required
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((_, i) => ({
          expected: true,
          data: {
            mainInputType,
            photos: true,
            notes: false,
          },
          userUpdate: {
            mainInputSelection: i,
            mainInputSelected,
            inspectorNotes: 'note',
            photosData: { one: {} },
          },
        }))
      ),

      // Meet requirements w/ only notes required
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((_, i) => ({
          expected: true,
          data: {
            mainInputType,
            notes: true,
            photos: false,
          },
          userUpdate: {
            mainInputSelection: i,
            mainInputSelected,
            inspectorNotes: 'notes',
          },
        }))
      ),

      // Meet requirements w/ notes & photos required
      ...Object.keys(DEFICIENT_ITEM_ELIGIBLE).map(mainInputType =>
        DEFICIENT_ITEM_ELIGIBLE[mainInputType].map((_, i) => ({
          expected: true,
          data: {
            mainInputType,
            notes: true,
            photos: true,
          },
          userUpdate: {
            mainInputSelection: i,
            mainInputSelected,
            inspectorNotes: 'notes',
            photosData: { one: {} },
          },
        }))
      )
    );

    tests.forEach(({ expected, data, userUpdate }) => {
      const inspection = mocking.createInspection({
        property: propertyId,
        itemsCompleted: 0,
        template: {
          requireDeficientItemNoteAndPhoto: true,
          sections: {
            [sectionId]: mocking.createSection(),
          },
          items: {
            one: mocking.createIncompleteMainInputItem(
              'twoactions_checkmarkx',
              {
                ...data,
                sectionId,
              }
            ),
          },
        },
      });
      const result = update(inspection, { items: { one: userUpdate } });
      const actual = result.itemsCompleted || 0;
      expect(actual).to.equal(
        expected ? 1 : 0,
        `item of ${data.mainInputType} type and selection ${
          userUpdate.mainInputSelection
        }, has ${data.notes ? '' : 'un'}required notes, ${
          userUpdate.inspectorNotes ? 'has ' : 'no '
        }notes, has ${data.photos ? '' : 'un'}required photos, ${
          userUpdate.photosData ? 'has ' : 'no '
        }photos, is ${
          data.isItemNA || userUpdate.isItemNA ? 'not ' : ''
        }applicable, should ${expected ? '' : 'not '}be counted as completed`
      );
    });
  });

  it('incompletes inspection when it has incomplete items', () => {
    const expected = false;
    const propertyId = uuid();
    const sectionId = uuid();

    // Non deficient list eligible valid item
    const inspection = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      template: {
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false,
            {
              sectionId,
            }
          ),
        },
      },
    });

    const result = update(inspection, {
      items: { one: { mainInputSelected: false } },
    });
    const actual = result.inspectionCompleted;
    expect(actual).to.equal(expected);
  });

  it('updates the completion date when the inspection becomes complete', () => {
    const expected = Math.round(Date.now() / 1000);
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: false,
      template: {
        requireDeficientItemNoteAndPhoto: true,
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
        },
      },
    });

    const result = update(
      inspection,
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
    const actual = result.completionDate;
    expect(actual).to.equal(expected);
  });

  it('detects when deficiencies exist', () => {
    const expected = true;
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      deficienciesExist: false,
      inspectionCompleted: false,
      template: {
        requireDeficientItemNoteAndPhoto: true,
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
        },
      },
    });

    const result = update(inspection, {
      items: {
        one: {
          deficient: true,
          mainInputSelected: true,
          mainInputSelection: 1,
        },
      },
    });
    const actual = result.deficienciesExist;
    expect(actual).to.equal(expected);
  });

  it('sets the score when it becomes completed', () => {
    const expected = 100;
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      deficienciesExist: false,
      inspectionCompleted: false,
      score: 0,
      template: {
        requireDeficientItemNoteAndPhoto: true,
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
          two: mocking.createCompletedMainInputItem(),
        },
      },
    });

    const result = update(inspection, {
      items: {
        one: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    });
    const actual = result.score;
    expect(actual).to.equal(expected);
  });

  it('sets a new updated at time', () => {
    const expected = Math.round(Date.now() / 1000);
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      deficienciesExist: false,
      inspectionCompleted: false,
      template: {
        requireDeficientItemNoteAndPhoto: true,
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
        },
      },
    });

    const result = update(
      inspection,
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

  it('sets last updated time when an inspection becomes complete again', () => {
    const expected = Math.round(Date.now() / 1000);
    const propertyId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      deficienciesExist: false,
      inspectionCompleted: false,
      template: {
        requireDeficientItemNoteAndPhoto: true,
        sections: {
          [sectionId]: mocking.createSection(),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId,
          }),
        },
      },
    });

    const result = update(
      inspection,
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
    const actual = result.updatedLastDate;
    expect(actual).to.equal(expected);
  });

  it('removes a deleted multi section', () => {
    const expected = null;
    const propertyId = uuid();
    const origSectionId = uuid();
    const addedSectionId = uuid();
    const sectionConfig = { title: 'Multi', section_type: 'multi' };
    const inspection = mocking.createInspection({
      property: propertyId,
      totalItems: 0,
      template: {
        sections: {
          [origSectionId]: mocking.createSection(sectionConfig), // original section
          [addedSectionId]: mocking.createSection({
            // cloned multi-section
            ...sectionConfig,
            index: 1,
            added_multi_section: true,
          }),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: origSectionId,
          }),
          two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: addedSectionId,
          }),
        },
      },
    });
    const changes = {
      sections: {
        [addedSectionId]: null,
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const resultSections = (result.template || {}).sections || {};
    const actual = resultSections[addedSectionId];
    expect(actual).to.equal(expected);
  });

  it("removes a deleted multi section's items", () => {
    const expected = [null, null];
    const propertyId = uuid();
    const origSectionId = uuid();
    const addedSectionId = uuid();
    const sectionConfig = { title: 'Multi', section_type: 'multi' };
    const inspection = mocking.createInspection({
      property: propertyId,
      totalItems: 0,
      template: {
        sections: {
          [origSectionId]: mocking.createSection(sectionConfig), // original section
          [addedSectionId]: mocking.createSection({
            // cloned multi-section
            ...sectionConfig,
            index: 1,
            added_multi_section: true,
          }),
        },
        items: {
          one: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: origSectionId,
          }),
          two: mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: addedSectionId,
          }),
          three: mocking.createIncompleteMainInputItem(
            'twoactions_checkmarkx',
            {
              sectionId: addedSectionId,
            }
          ),
        },
      },
    });
    const changes = {
      sections: {
        [addedSectionId]: null,
      },
    };

    // Assertions
    const result = update(inspection, changes);
    const resultSections = (result.template || {}).items || {};
    const actual = [resultSections.two, resultSections.three];
    expect(actual).to.deep.equal(expected);
  });
});
