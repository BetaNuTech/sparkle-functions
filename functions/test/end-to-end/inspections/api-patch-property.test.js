const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../inspections/api/patch-property');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs } = require('../../setup');
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
const PROPERTY_PATH = `/properties/${PROPERTY_ID}`;
const INSPECTION_PATH = `/inspections/${INSPECTION_ID}`;
const DEST_PROPERTY_PATH = `/properties/${DEST_PROPERTY_ID}`;
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
  afterEach(() => cleanDb(db, fs));

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

  it('updates any existing firebase records', async () => {
    // setup database
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreCreateRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await propertiesModel.realtimeUpsertRecord(
      db,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreCreateRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.realtimeUpsertRecord(
      db,
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
    const inspectionPropertySnap = await db
      .ref(`${INSPECTION_PATH}/property`)
      .once('value');
    const archivedInspSnap = await db
      .ref(`/archive${INSPECTION_PATH}`)
      .once('value');
    const srcPropInspRelSnap = await db
      .ref(`${PROPERTY_PATH}/inspections/${INSPECTION_ID}`)
      .once('value');
    const destPropInspRelSnap = await db
      .ref(`${DEST_PROPERTY_PATH}/inspections/${INSPECTION_ID}`)
      .once('value');
    const srcPropInspProxySnap = await db
      .ref(
        `/propertyInspectionsList/${PROPERTY_ID}/inspections/${INSPECTION_ID}`
      )
      .once('value');
    const destPropInspProxySnap = await db
      .ref(
        `/propertyInspectionsList/${DEST_PROPERTY_ID}/inspections/${INSPECTION_ID}`
      )
      .once('value');
    const completedInspProxyPropSnap = await db
      .ref(`/completedInspectionsList/${INSPECTION_ID}/property`)
      .once('value');

    // Assertions
    [
      {
        actual: inspectionPropertySnap.val(),
        expected: DEST_PROPERTY_ID,
        msg: "reassiged inspection's property",
      },
      {
        actual: archivedInspSnap.exists(),
        expected: false,
        msg: 'does not create archived inspection',
      },
      {
        actual: srcPropInspRelSnap.exists(),
        expected: false,
        msg: "removed source property's inspection relationship",
      },
      {
        actual: destPropInspRelSnap.exists(),
        expected: true,
        msg: "added dest property's inspection relationship",
      },
      {
        actual: srcPropInspProxySnap.exists(),
        expected: false,
        msg: "removed source property's inspection proxy",
      },
      {
        actual: destPropInspProxySnap.exists(),
        expected: true,
        msg: "added dest property's inspection proxy",
      },
      {
        actual: completedInspProxyPropSnap.val(),
        expected: DEST_PROPERTY_ID,
        msg: "reassigned completed inspection proxy's property",
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

  it('updates any realtime previous/current property meta data', async () => {
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
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreUpsertRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await propertiesModel.realtimeUpsertRecord(
      db,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.realtimeUpsertRecord(
      db,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_TWO_ID,
      INSPECTION_TWO_DATA
    );
    await inspectionsModel.realtimeUpsertRecord(
      db,
      INSPECTION_TWO_ID,
      INSPECTION_TWO_DATA
    );
    await deficientItemsModel.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_ONE_DATA
    );
    await deficientItemsModel.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_TWO_DATA
    );

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Test results
    const srcPropertySnap = await propertiesModel.findRecord(db, PROPERTY_ID);
    const destPropertySnap = await propertiesModel.findRecord(
      db,
      DEST_PROPERTY_ID
    );
    const srcProp = srcPropertySnap.val();
    const destProp = destPropertySnap.val();

    // Assertions
    [
      {
        actual: srcProp.numOfDeficientItems,
        expected: 0,
        msg: "updated realtime source property's num of deficient items",
      },
      {
        actual: destProp.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated realtime destination property's num of deficient items",
      },
      {
        actual: srcProp.numOfInspections,
        expected: 1,
        msg: "updated realtime source property's num of inspections",
      },
      {
        actual: destProp.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated realtime destination property's num of inspections",
      },
      {
        actual: srcProp.numOfRequiredActionsForDeficientItems,
        expected: 0,
        msg: "updated realtime source property's number of required actions",
      },
      {
        actual: destProp.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated realtime dest property's number of required actions",
      },
      {
        actual: srcProp.numOfFollowUpActionsForDeficientItems,
        expected: 0,
        msg: "updated realtime source property's number of follow up actions",
      },
      {
        actual: destProp.numOfFollowUpActionsForDeficientItems,
        expected: final.numOfFollowUpActionsForDeficientItems,
        msg: "updated realtime dest property's number of follow up actions",
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

  it('reassigns any active realtime deficient items under new property', async () => {
    // setup database
    await propertiesModel.firestoreUpsertRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreUpsertRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await propertiesModel.realtimeUpsertRecord(
      db,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreUpsertRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.realtimeUpsertRecord(
      db,
      INSPECTION_ID,
      INSPECTION_DATA
    );

    // Stup active DI database
    const diOne = await deficientItemsModel.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_ONE_DATA
    );
    const diTwo = await deficientItemsModel.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_TWO_DATA
    );
    const diThree = await deficientItemsModel.realtimeCreateRecord(
      db,
      RAND_PROP_ID,
      RAND_DEF_ITEM_DATA
    ); // unrelated DI
    const diOneId = getRefId(diOne);
    const diTwoId = getRefId(diTwo);
    const diThreeId = getRefId(diThree);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const oldDiOneSnap = await deficientItemsModel.find(
      db,
      PROPERTY_ID,
      diOneId
    );
    const oldDiTwoSnap = await deficientItemsModel.find(
      db,
      PROPERTY_ID,
      diTwoId
    );
    const oldDiThreeSnap = await deficientItemsModel.find(
      db,
      RAND_PROP_ID,
      diThreeId
    );
    const newDiOneSnap = await deficientItemsModel.find(
      db,
      DEST_PROPERTY_ID,
      diOneId
    );
    const newDiTwoSnap = await deficientItemsModel.find(
      db,
      DEST_PROPERTY_ID,
      diTwoId
    );
    const newDiThreeSnap = await deficientItemsModel.find(
      db,
      DEST_PROPERTY_ID,
      diThreeId
    );

    // Assertions
    [
      {
        actual: oldDiOneSnap.val(),
        expected: null,
        msg: 'removed first DI from old property',
      },
      {
        actual: oldDiTwoSnap.val(),
        expected: null,
        msg: 'removed second DI from old property',
      },
      {
        actual: oldDiThreeSnap.val(),
        expected: RAND_DEF_ITEM_DATA,
        msg: 'unrelated realtime deficient item is uncahanged',
      },
      {
        actual: newDiOneSnap.val(),
        expected: DEFICIENT_ITEM_ONE_DATA,
        msg: "reassiged inspection's first DI to new property",
      },
      {
        actual: newDiTwoSnap.val(),
        expected: DEFICIENT_ITEM_TWO_DATA,
        msg: "reassiged inspection's seconde DI to new property",
      },
      {
        actual: newDiThreeSnap.val(),
        expected: null,
        msg: 'does not move unrelated realtime record under new property',
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

  it('reassigns any archived realtime deficient items under new property', async () => {
    const diOneId = uuid();
    const diTwoId = uuid();
    const diThreeId = uuid();

    // setup database
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, PROPERTY_DATA);
    await propertiesModel.firestoreCreateRecord(
      fs,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await propertiesModel.realtimeUpsertRecord(
      db,
      DEST_PROPERTY_ID,
      DEST_PROPERTY_DATA
    );
    await inspectionsModel.firestoreCreateRecord(
      fs,
      INSPECTION_ID,
      INSPECTION_DATA
    );
    await inspectionsModel.realtimeUpsertRecord(
      db,
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
    await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      diOneId,
      DEFICIENT_ITEM_ONE_DATA
    );
    await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      diTwoId,
      DEFICIENT_ITEM_TWO_DATA
    );
    await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      RAND_PROP_ID,
      diThreeId,
      RAND_DEF_ITEM_DATA
    );

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const oldDiOneSnap = await archiveModel.deficientItem.findRecord(
      db,
      PROPERTY_ID,
      diOneId
    );
    const oldDiTwoSnap = await archiveModel.deficientItem.findRecord(
      db,
      PROPERTY_ID,
      diTwoId
    );
    const oldDiThreeSnap = await archiveModel.deficientItem.findRecord(
      db,
      RAND_PROP_ID,
      diThreeId
    );
    const newDiOneSnap = await archiveModel.deficientItem.findRecord(
      db,
      DEST_PROPERTY_ID,
      diOneId
    );
    const newDiTwoSnap = await archiveModel.deficientItem.findRecord(
      db,
      DEST_PROPERTY_ID,
      diTwoId
    );
    const newDiThreeSnap = await archiveModel.deficientItem.findRecord(
      db,
      DEST_PROPERTY_ID,
      diThreeId
    );

    // Assertions
    [
      {
        actual: oldDiOneSnap.val(),
        expected: null,
        msg: 'removed first archive DI from old property',
      },
      {
        actual: oldDiTwoSnap.val(),
        expected: null,
        msg: 'removed second archive DI from old property',
      },
      {
        actual: oldDiThreeSnap.val(),
        expected: { ...RAND_DEF_ITEM_DATA, archive: true },
        msg: 'has no effect on unrelated realtime deficient item',
      },
      {
        actual: newDiOneSnap.val(),
        expected: { ...DEFICIENT_ITEM_ONE_DATA, archive: true },
        msg: "reassiged inspection's first archive DI to new property",
      },
      {
        actual: newDiTwoSnap.val(),
        expected: { ...DEFICIENT_ITEM_TWO_DATA, archive: true },
        msg: "reassiged inspection's second archive DI to new property",
      },
      {
        actual: newDiThreeSnap.val(),
        expected: null,
        msg: 'did not create new realtime archive for unrelated deficient item',
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
  app.patch('/t/:inspectionId', bodyParser.json(), handler(db, fs));
  return app;
}

function getRefId(ref) {
  return ref.path
    .toString()
    .split('/')
    .pop();
}
