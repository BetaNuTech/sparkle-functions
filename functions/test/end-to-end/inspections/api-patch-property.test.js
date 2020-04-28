const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../inspections/api/patch-property');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs } = require('../../setup');
const mocking = require('../../../test-helpers/mocking');
const deficientItemsModel = require('../../../models/deficient-items');

const PROPERTY_ID = uuid();
const INSPECTION_ID = uuid();
const DEST_PROPERTY_ID = uuid();
const PROPERTY_PATH = `/properties/${PROPERTY_ID}`;
const INSPECTION_PATH = `/inspections/${INSPECTION_ID}`;
const DEST_PROPERTY_PATH = `/properties/${DEST_PROPERTY_ID}`;
const PROPERTY_DATA = {
  name: 'src',
  inspections: { [INSPECTION_ID]: true },
};
const DEST_PROPERTY_DATA = { name: 'dest' };
const INSPECTION_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  inspectionCompleted: true,
});
const DEFICIENT_ITEM_ONE_DATA = mocking.createDeficientItem(
  INSPECTION_ID,
  uuid()
);
const DEFICIENT_ITEM_TWO_DATA = mocking.createDeficientItem(
  INSPECTION_ID,
  uuid()
);

describe('Inspections | API | Patch Property', () => {
  afterEach(() => cleanDb(db, fs));

  it('rejects request missing a payload', async () => {
    const expected = 'body missing property';

    // Execute & Get Result
    const app = createApp();
    const result = await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send()
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('rejects request to reassign non-existent property', async () => {
    const expected = 'body contains bad property';

    // setup database
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp();
    const result = await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: '-invalid' })
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('rejects request to reassign non-existent inspection', async () => {
    const expected = 'requested inspection not found';

    // setup database
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(DEST_PROPERTY_PATH).set(DEST_PROPERTY_DATA);
    await db.ref(INSPECTION_PATH).set(INSPECTION_DATA);

    // Execute & Get Result
    const app = createApp();
    const result = await request(app)
      .patch('/t/-invalid')
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('successfully reassigns an inspection to a new property', async () => {
    // setup database
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(DEST_PROPERTY_PATH).set(DEST_PROPERTY_DATA);
    await db.ref(INSPECTION_PATH).set(INSPECTION_DATA);

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

  it("successfully reassigns an inspection's realtime deficient items under new property", async () => {
    // setup database
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(DEST_PROPERTY_PATH).set(DEST_PROPERTY_DATA);
    await db.ref(INSPECTION_PATH).set(INSPECTION_DATA);
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

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ property: DEST_PROPERTY_ID })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const diOneId = getRefId(diOne);
    const diTwoId = getRefId(diTwo);
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
        actual: newDiOneSnap.val(),
        expected: DEFICIENT_ITEM_ONE_DATA,
        msg: "reassiged inspection's first DI to new property",
      },
      {
        actual: newDiTwoSnap.val(),
        expected: DEFICIENT_ITEM_TWO_DATA,
        msg: "reassiged inspection's seconde DI to new property",
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
  app.patch('/t/:inspectionId', bodyParser.json(), handler(db));
  return app;
}

function getRefId(ref) {
  return ref.path
    .toString()
    .split('/')
    .pop();
}
