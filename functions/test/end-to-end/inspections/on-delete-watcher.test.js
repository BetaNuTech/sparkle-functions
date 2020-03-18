const path = require('path');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const { db, fs, test, storage, cloudFunctions } = require('../../setup');

const SRC_UPLOAD_IMG = 'test-image.jpg';
const SRC_UPLOAD_IMG_DIR = path.resolve(__dirname, '..');
const INSP_UPLOAD_DIR = 'inspectionItemImagesTest';
const PROPERTY_ID = uuid();
const INSPECTION_ID = uuid();
const PROPERTY_PATH = `/properties/${PROPERTY_ID}`;
const INSPECTION_PATH = `/inspections/${INSPECTION_ID}`;
const COMPLETED_INSP_PROXY_PATH = `/completedInspectionsList/${INSPECTION_ID}`;
const PROP_INSP_PROXY_PATH = `/propertyInspectionsList/${PROPERTY_ID}/inspections/${INSPECTION_ID}`;
const PROPERTY_DATA = {
  name: 'test property',
  inspections: { [INSPECTION_ID]: true },
};

describe('Inspections | On Delete Watcher', () => {
  afterEach(() => cleanDb(db, fs));

  it("archives inspection and removes its' public facing references", async () => {
    const now = Math.round(Date.now() / 1000);
    const inspectionData = {
      templateName: 'template',
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: PROPERTY_ID,
      updatedLastDate: now,
      inspectionCompleted: true,
    };

    // Setup database
    await db.ref(INSPECTION_PATH).set(inspectionData);
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(COMPLETED_INSP_PROXY_PATH).set(inspectionData); // Add completedInspectionsList
    await db.ref(PROP_INSP_PROXY_PATH).set(inspectionData); // Add propertyInspectionsList
    const snap = await db.ref(INSPECTION_PATH).once('value'); // Create snap
    await db.ref(INSPECTION_PATH).remove(); // Remove inspection

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDelete);
    await wrapped(snap, { params: { inspectionId: INSPECTION_ID } });

    // Test result
    const [inspectionSnap, propertyRelSnap] = await Promise.all([
      db.ref(`archive${INSPECTION_PATH}`).once('value'),
      db.ref(`${PROPERTY_PATH}/inspections/${INSPECTION_ID}`).once('value'),
    ]);

    // Assertions
    [
      {
        actual: inspectionSnap.exists(),
        expected: true,
        msg: 'added inspection to archive',
      },
      {
        actual: propertyRelSnap.exists(),
        expected: false,
        msg: 'remove property inspection relationship',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should remove proxy records of a deleted inspection', async () => {
    const now = Math.round(Date.now() / 1000);
    const inspectionData = {
      templateName: 'template',
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: PROPERTY_ID,
      updatedLastDate: now,
      inspectionCompleted: true,
    };

    // Setup database
    await db.ref(INSPECTION_PATH).set(inspectionData);
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(COMPLETED_INSP_PROXY_PATH).set(inspectionData); // Add completedInspectionsList
    await db.ref(PROP_INSP_PROXY_PATH).set(inspectionData); // Add propertyInspectionsList
    const snap = await db.ref(INSPECTION_PATH).once('value'); // Create snap
    await db.ref(INSPECTION_PATH).remove(); // Remove inspection

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDelete);
    await wrapped(snap, { params: { inspectionId: INSPECTION_ID } });

    // Test result
    const result = await Promise.all([
      db.ref(COMPLETED_INSP_PROXY_PATH).once('value'),
      db.ref(PROP_INSP_PROXY_PATH).once('value'),
    ]);
    const actual = result.map(ds => ds.exists());

    // Assertions
    expect(actual).to.deep.equal([false, false]);
  });

  it('should update property meta data when latest completed inspection is removed', async () => {
    const insp2Id = uuid();
    const newest = Math.round(Date.now() / 1000);
    const oldest = Math.round(Date.now() / 1000 - 100000);
    const inspectionOne = mocking.createInspection({
      property: PROPERTY_ID,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
    });
    const inspectionTwo = mocking.createInspection({
      property: PROPERTY_ID,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: {
          [uuid()]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });
    const propertyData = Object.assign({}, PROPERTY_DATA);
    propertyData.inspections[insp2Id] = true;

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      INSPECTION_ID,
      inspectionOne
    );
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspectionTwo);
    const snap = await inspectionsModel.findRecord(db, INSPECTION_ID);
    await inspectionsModel.realtimeRemoveRecord(db, INSPECTION_ID);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDelete);
    await wrapped(snap, { params: { inspectionId: INSPECTION_ID } });

    // Test result
    const propertySnap = await propertiesModel.findRecord(db, PROPERTY_ID);
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      PROPERTY_ID
    );
    const realtime = propertySnap.val();
    const firestore = propertyDoc.data();

    // Assertions
    [
      {
        expected: 1,
        actual: realtime.numOfInspections,
        msg: "updated realtime property's number of inspections",
      },
      {
        expected: 1,
        actual: firestore.numOfInspections,
        msg: "updated firestore property's number of inspections",
      },
      {
        expected: inspectionTwo.score,
        actual: realtime.lastInspectionScore,
        msg: "updated realtime property's last inspection score",
      },
      {
        expected: inspectionTwo.score,
        actual: firestore.lastInspectionScore,
        msg: "updated firestore property's last inspection score",
      },
      {
        expected: inspectionTwo.creationDate,
        actual: realtime.lastInspectionDate,
        msg: "updated realtime property's last inspection date",
      },
      {
        expected: inspectionTwo.creationDate,
        actual: firestore.lastInspectionDate,
        msg: "updated firestore property's last inspection date",
      },
      {
        expected: 1,
        actual: realtime.numOfDeficientItems,
        msg: "updated realtime property's number of deficient items",
      },
      {
        expected: 1,
        actual: firestore.numOfDeficientItems,
        msg: "updated firestore property's number of deficient items",
      },
      {
        expected: 1,
        actual: realtime.numOfRequiredActionsForDeficientItems,
        msg: "updated realtime property's number of required actions",
      },
      {
        expected: 1,
        actual: firestore.numOfRequiredActionsForDeficientItems,
        msg: "updated firestore property's number of required actions",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it("should remove an inspection's uploaded images from storage", async () => {
    const bucket = storage.bucket();

    // Setup database
    const destination1 = `${INSP_UPLOAD_DIR}/${INSPECTION_ID}-${Date.now()}-1-${SRC_UPLOAD_IMG}`;
    const destination2 = `${INSP_UPLOAD_DIR}/${INSPECTION_ID}-${Date.now()}-2-${SRC_UPLOAD_IMG}`;
    await bucket.upload(`${SRC_UPLOAD_IMG_DIR}/${SRC_UPLOAD_IMG}`, {
      gzip: true,
      destination: destination1,
    }); // upload file
    const uploadedFile1 = await findStorageFile(
      bucket,
      INSP_UPLOAD_DIR,
      destination1
    ); // find the file
    const [url1] = await uploadedFile1.getSignedUrl({
      action: 'read',
      expires: '01-01-2491',
    }); // get download URL
    await bucket.upload(`${SRC_UPLOAD_IMG_DIR}/${SRC_UPLOAD_IMG}`, {
      gzip: true,
      destination: destination2,
    }); // upload file
    const uploadedFile2 = await findStorageFile(
      bucket,
      INSP_UPLOAD_DIR,
      destination2
    ); // find the file
    const [url2] = await uploadedFile2.getSignedUrl({
      action: 'read',
      expires: '01-01-2491',
    }); // get download URL
    // Create inspection /w uploads
    await db.ref(INSPECTION_PATH).set({
      name: INSPECTION_ID,
      property: PROPERTY_ID,
      template: {
        items: {
          [uuid()]: { photosData: { [Date.now()]: { downloadURL: url1 } } },
          [uuid()]: { photosData: { [Date.now()]: { downloadURL: url2 } } },
          [uuid()]: {}, // no uploads
        },
      },
    });
    const snap = await db.ref(INSPECTION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDelete);
    await wrapped(snap, { params: { inspectionId: INSPECTION_ID } });

    // Test results
    let actual = await findStorageFile(bucket, INSP_UPLOAD_DIR, destination1); // find the upload
    expect(actual).to.equal(
      undefined,
      `removed upload file 1 at ${destination1}`
    );

    actual = await findStorageFile(bucket, INSP_UPLOAD_DIR, destination2); // find the upload
    expect(actual).to.equal(
      undefined,
      `removed upload file 2 at: ${destination2}`
    );
  });
});
