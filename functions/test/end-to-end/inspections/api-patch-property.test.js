const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../inspections/api/patch-property');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');
const mocking = require('../../../test-helpers/mocking');
const archiveModel = require('../../../models/_internal/archive');
const deficientItemsModel = require('../../../models/deficient-items');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');

const PROPERTY_ID = uuid();
const INSPECTION_ID = uuid();
const INSPECTION_TWO_ID = uuid();
const ITEM_ID = uuid();
const ITEM_TWO_ID = uuid();
const DEST_PROPERTY_ID = uuid();
const RAND_PROP_ID = uuid();
const PROPERTY_DATA = {
  name: 'src',
  inspections: { [INSPECTION_ID]: true, [INSPECTION_TWO_ID]: true },
};
const DEST_PROPERTY_DATA = { name: 'dest' };
const ITEM_DATA = mocking.createCompletedMainInputItem(
  'twoactions_checkmarkx',
  true
);
const ITEM_TWO_DATA = mocking.createCompletedMainInputItem(
  'twoactions_checkmarkx',
  true
);
const INSPECTION_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  inspectionCompleted: true,
  score: 65,
  template: {
    trackDeficientItems: true,

    // Create template w/ 1 deficient item
    items: {
      [ITEM_ID]: ITEM_DATA,
      [ITEM_TWO_ID]: ITEM_TWO_DATA,
    },
  },
});
const INSPECTION_TWO_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  inspectionCompleted: true,
});
const DEFICIENT_ITEM_ONE_DATA = mocking.createDeficientItem(
  INSPECTION_ID,
  ITEM_ID,
  ITEM_DATA
);
const DEFICIENT_ITEM_TWO_DATA = mocking.createDeficientItem(
  INSPECTION_ID,
  ITEM_TWO_ID,
  ITEM_TWO_DATA
);
const RAND_DEF_ITEM_DATA = mocking.createDeficientItem(
  uuid(),
  ITEM_TWO_ID,
  ITEM_TWO_DATA
);

describe('Inspections | API | Patch Property', () => {
  afterEach(() => cleanDb(null, fs));

  it('successfully reassigns an inspection to a new property', async () => {
    // setup database
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreCreateRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreCreateRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const inspectionSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      INSPECTION_ID
    );
    const archivedInsp = await archiveModel.inspection.firestoreFindRecord(
      fs,
      INSPECTION_ID
    );
    const srcPropertySnap = await propertiesModel.firestoreFindRecord(
      fs,
      PROPERTY_ID
    );
    const destPropertySnap = await propertiesModel.firestoreFindRecord(
      fs,
      DEST_PROPERTY_ID
    );

    // Assertions
    [
      {
        actual: (inspectionSnap.data() || {}).property || '',
        expected: DEST_PROPERTY_ID,
        msg: "reassiged firestore inspection's property",
      },
      {
        actual: archivedInsp.exists,
        expected: false,
        msg: 'does not create firestore archived inspection',
      },
      {
        actual: Boolean(
          ((srcPropertySnap.data() || {}).inspections || {})[INSPECTION_ID]
        ),
        expected: false,
        msg: "removed source firestore property's inspection relationship",
      },
      {
        actual: Boolean(
          ((destPropertySnap.data() || {}).inspections || {})[INSPECTION_ID]
        ),
        expected: true,
        msg: "added dest firestore property's inspection relationship",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('updates previous and current property meta data', async () => {
    const diOneId = uuid();
    const diTwoId = uuid();
    const final = {
      numOfDeficientItems: 2,
      numOfInspections: 1,
      lastInspectionScore: INSPECTION_DATA.score,
      numOfRequiredActionsForDeficientItems: 2,
      numOfFollowUpActionsForDeficientItems: 0,
    };
    const srcPropertyData = {
      ...PROPERTY_DATA,
      ...final,
      numOfInspections: Object.keys(PROPERTY_DATA.inspections).length,
    };

    // Setup database
    await propertiesModel.firestoreUpsertRecord(
      fs,
      PROPERTY_ID,
      srcPropertyData
    );
    await propertiesModel.firestoreUpsertRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_TWO_ID,
      INSPECTION_TWO_DATA
    );
    await deficientItemsModel.firestoreCreateRecord(fs, diOneId, {
      ...DEFICIENT_ITEM_ONE_DATA,
      property: PROPERTY_ID,
    });
    await deficientItemsModel.firestoreCreateRecord(fs, diTwoId, {
      ...DEFICIENT_ITEM_TWO_DATA,
      property: PROPERTY_ID,
    });

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Test results
    const srcPropertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      PROPERTY_ID
    );
    const destPropertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      DEST_PROPERTY_ID
    );
    const srcProp = srcPropertyDoc.data();
    const destProp = destPropertyDoc.data();

    // Assertions
    [
      {
        actual: srcProp.numOfDeficientItems,
        expected: 0,
        msg: "updated source property's num of deficient items",
      },
      {
        actual: destProp.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated destination property's num of deficient items",
      },
      {
        actual: srcProp.numOfInspections,
        expected: 1,
        msg: "updated source property's num of inspections",
      },
      {
        actual: destProp.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated destination property's num of inspections",
      },
      {
        actual: srcProp.numOfRequiredActionsForDeficientItems,
        expected: 0,
        msg: "updated source property's number of required actions",
      },
      {
        actual: destProp.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated dest property's number of required actions",
      },
      {
        actual: srcProp.numOfFollowUpActionsForDeficientItems,
        expected: 0,
        msg: "updated source property's number of follow up actions",
      },
      {
        actual: destProp.numOfFollowUpActionsForDeficientItems,
        expected: final.numOfFollowUpActionsForDeficientItems,
        msg: "updated dest property's number of follow up actions",
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it('reassigns active deficient items under new property', async () => {
    const diOneId = uuid();
    const diTwoId = uuid();
    const diThreeId = uuid();

    // setup database
    await propertiesModel.firestoreUpsertRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreUpsertRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );

    // Stup active DI database
    await deficientItemsModel.firestoreCreateRecord(fs, diOneId, {
      ...DEFICIENT_ITEM_ONE_DATA,
      property: PROPERTY_ID,
    });
    await deficientItemsModel.firestoreCreateRecord(fs, diTwoId, {
      ...DEFICIENT_ITEM_TWO_DATA,
      property: PROPERTY_ID,
    });
    await deficientItemsModel.firestoreCreateRecord(fs, diThreeId, {
      ...RAND_DEF_ITEM_DATA,
      property: RAND_PROP_ID,
    });

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const srcPropDoc = await propertiesModel.firestoreFindRecord(
      fs,
      PROPERTY_ID
    );
    const destPropDoc = await propertiesModel.firestoreFindRecord(
      fs,
      DEST_PROPERTY_ID
    );
    const diOneDoc = await deficientItemsModel.firestoreFindRecord(fs, diOneId);
    const diTwoDoc = await deficientItemsModel.firestoreFindRecord(fs, diTwoId);
    const diThreeDoc = await deficientItemsModel.firestoreFindRecord(
      fs,
      diThreeId
    );

    // Assertions
    [
      {
        actual: ((srcPropDoc.data() || {}).inspections || {})[INSPECTION_ID],
        expected: undefined,
        msg: 'removed inspection relationship from source realtime property',
      },
      {
        actual: ((destPropDoc.data() || {}).inspections || {})[INSPECTION_ID],
        expected: true,
        msg: 'added inspection relationship to target firestore property',
      },
      {
        actual: diOneDoc.data().property,
        expected: DEST_PROPERTY_ID,
        msg: "reassiged inspection's first firestore DI to new property",
      },
      {
        actual: diTwoDoc.data().property,
        expected: DEST_PROPERTY_ID,
        msg: "reassiged inspection's second firestore DI to new property",
      },
      {
        actual: diThreeDoc.data().property,
        expected: RAND_PROP_ID,
        msg: 'has no effect on unrelated firestore deficient item',
      },
    ].forEach(({ actual, expected, msg }) => {
      if (!expected) {
        expect(actual).to.equal(expected, msg);
      } else {
        expect(actual).to.deep.equal(expected, msg);
      }
    });
  });

  it('reassigns archived deficient items under new property', async () => {
    const diOneId = uuid();
    const diTwoId = uuid();
    const diThreeId = uuid();

    // setup database
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreCreateRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreCreateRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );

    // Stup archive DI database
    await archiveModel.deficientItem.firestoreCreateRecord(fs, diOneId, {
      ...DEFICIENT_ITEM_ONE_DATA,
      property: PROPERTY_ID,
    });
    await archiveModel.deficientItem.firestoreCreateRecord(fs, diTwoId, {
      ...DEFICIENT_ITEM_TWO_DATA,
      property: PROPERTY_ID,
    });
    await archiveModel.deficientItem.firestoreCreateRecord(fs, diThreeId, {
      ...RAND_DEF_ITEM_DATA,
      property: RAND_PROP_ID,
    });

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const diOneDoc = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      diOneId
    );
    const diTwoDoc = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      diTwoId
    );
    const diThreeDoc = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      diThreeId
    );

    // Assertions
    [
      {
        actual: diOneDoc.data().property,
        expected: DEST_PROPERTY_ID,
        msg:
          "reassiged inspection's first archive firestore DI to new property",
      },
      {
        actual: diTwoDoc.data().property,
        expected: DEST_PROPERTY_ID,
        msg:
          "reassiged inspection's second archive firestore DI to new property",
      },
      {
        actual: diThreeDoc.data().property,
        expected: RAND_PROP_ID,
        msg: 'had no affected on unrelated archived firestore DI property',
      },
    ].forEach(({ actual, expected, msg }) => {
      if (!expected) {
        expect(actual).to.equal(expected, msg);
      } else {
        expect(actual).to.deep.equal(expected, msg);
      }
    });
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:inspectionId', bodyParser.json(), handler(fs));
  return app;
}
