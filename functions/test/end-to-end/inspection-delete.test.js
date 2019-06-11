const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb, findStorageFile } = require('../../test-helpers/firebase');
const { db, test, storage, cloudFunctions } = require('./setup');

const SRC_UPLOAD_IMG = 'test-image.jpg';
const INSP_UPLOAD_DIR = 'inspectionItemImagesTest';

describe('Inspection Delete', () => {
  afterEach(() => cleanDb(db));

  it('should remove proxy records of a deleted inspection', () =>
    co(function*() {
      const inspId = uuid();
      const propertyId = uuid();
      const now = Date.now() / 1000;
      const inspectionData = {
        templateName: `name${inspId}`,
        inspector: '23423423',
        inspectorName: 'testor',
        creationDate: now - 100000,
        score: 10,
        deficienciesExist: false,
        itemsCompleted: 10,
        totalItems: 10,
        property: propertyId,
        updatedLastDate: now,
        inspectionCompleted: true,
      };

      // Setup database
      yield db.ref(`/inspections/${inspId}`).set(inspectionData); // Add inspection
      yield db
        .ref(`/properties/${propertyId}`)
        .set({ name: `name${propertyId}` }); // required
      yield db.ref(`/completedInspections/${inspId}`).set(inspectionData); // Add completedInspections
      yield db.ref(`/completedInspectionsList/${inspId}`).set(inspectionData); // Add completedInspectionsList
      yield db
        .ref(`/propertyInspections/${propertyId}/inspections/${inspId}`)
        .set(inspectionData); // Add propertyInspections
      yield db
        .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`)
        .set(inspectionData); // Add propertyInspectionsList
      const snap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create snap
      yield db.ref(`/inspections/${inspId}`).remove(); // Remove inspection

      // Execute
      const wrapped = test.wrap(cloudFunctions.inspectionDelete);
      yield wrapped(snap, { params: { inspectionId: inspId } });

      // Test result
      const actual = yield Promise.all([
        db.ref(`/completedInspections/${inspId}`).once('value'),
        db.ref(`/completedInspectionsList/${inspId}`).once('value'),
        db
          .ref(`/propertyInspections/${propertyId}/inspections/${inspId}`)
          .once('value'),
        db
          .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`)
          .once('value'),
      ]);

      // Assertions
      expect(actual.map(ds => ds.exists())).to.deep.equal([
        false,
        false,
        false,
        false,
      ]);
    }));

  it('should update property meta data when latest completed inspection is removed', () =>
    co(function*() {
      const insp1Id = uuid();
      const insp2Id = uuid();
      const propertyId = uuid();
      const newest = Date.now() / 1000;
      const oldest = Date.now() / 1000 - 100000;
      const inspectionOne = mocking.createInspection({
        property: propertyId,
        inspectionCompleted: true,
        creationDate: newest,
        score: 65,
      });
      const inspectionTwo = mocking.createInspection({
        property: propertyId,
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
      const expected = {
        numOfInspections: 1,
        lastInspectionScore: inspectionTwo.score,
        lastInspectionDate: inspectionTwo.creationDate,
        numOfDeficientItems: 1,
        numOfRequiredActionsForDeficientItems: 1,
      };

      // Setup database
      yield db
        .ref(`/properties/${propertyId}`)
        .set({ name: `name${propertyId}` }); // required
      yield db.ref(`/inspections/${insp1Id}`).set(inspectionOne); // Add inspection #1
      yield db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // Add inspection #2
      const snap = yield db.ref(`/inspections/${insp1Id}`).once('value'); // Create snap
      yield db.ref(`/inspections/${insp1Id}`).remove(); // remove inspection #1

      // Execute
      const wrapped = test.wrap(cloudFunctions.inspectionDelete);
      yield wrapped(snap, { params: { inspectionId: insp1Id } });

      // Test result
      const propertySnap = yield db
        .ref(`/properties/${propertyId}`)
        .once('value');
      const actual = propertySnap.val();

      // Assertions
      expect(actual.numOfInspections).to.equal(
        expected.numOfInspections,
        "updated property's `numOfInspections`"
      );
      expect(actual.lastInspectionScore).to.equal(
        expected.lastInspectionScore,
        "updated property's `lastInspectionScore`"
      );
      expect(actual.lastInspectionDate).to.equal(
        expected.lastInspectionDate,
        "updated property's `lastInspectionDate`"
      );
      expect(actual.numOfDeficientItems).to.equal(
        expected.numOfDeficientItems,
        "updated property's `numOfDeficientItems`"
      );
      expect(actual.numOfRequiredActionsForDeficientItems).to.equal(
        expected.numOfRequiredActionsForDeficientItems,
        "updated property's `numOfRequiredActionsForDeficientItems`"
      );
    }));

  it("should remove an inspection's uploaded images from storage", () =>
    co(function*() {
      const propertyId = uuid();
      const inspectionId = uuid();
      const bucket = storage.bucket();

      // Setup database
      const destination1 = `${INSP_UPLOAD_DIR}/${inspectionId}-${Date.now()}-1-${SRC_UPLOAD_IMG}`;
      const destination2 = `${INSP_UPLOAD_DIR}/${inspectionId}-${Date.now()}-2-${SRC_UPLOAD_IMG}`;
      yield bucket.upload(`${__dirname}/${SRC_UPLOAD_IMG}`, {
        gzip: true,
        destination: destination1,
      }); // upload file
      const uploadedFile1 = yield findStorageFile(
        bucket,
        INSP_UPLOAD_DIR,
        destination1
      ); // find the file
      const [url1] = yield uploadedFile1.getSignedUrl({
        action: 'read',
        expires: '01-01-2491',
      }); // get download URL
      yield bucket.upload(`${__dirname}/${SRC_UPLOAD_IMG}`, {
        gzip: true,
        destination: destination2,
      }); // upload file
      const uploadedFile2 = yield findStorageFile(
        bucket,
        INSP_UPLOAD_DIR,
        destination2
      ); // find the file
      const [url2] = yield uploadedFile2.getSignedUrl({
        action: 'read',
        expires: '01-01-2491',
      }); // get download URL
      // Create inspection /w uploads
      yield db.ref(`/inspections/${inspectionId}`).set({
        name: inspectionId,
        property: propertyId,
        template: {
          items: {
            [uuid()]: { photosData: { [Date.now()]: { downloadURL: url1 } } },
            [uuid()]: { photosData: { [Date.now()]: { downloadURL: url2 } } },
            [uuid()]: {}, // no uploads
          },
        },
      });
      const snap = yield db.ref(`/inspections/${inspectionId}`).once('value');

      // Execute
      const wrapped = test.wrap(cloudFunctions.inspectionDelete);
      yield wrapped(snap, { params: { inspectionId } });

      // Test results
      let actual = yield findStorageFile(bucket, INSP_UPLOAD_DIR, destination1); // find the upload
      expect(actual).to.equal(undefined, 'removed upload file 1');

      actual = yield findStorageFile(bucket, INSP_UPLOAD_DIR, destination2); // find the upload
      expect(actual).to.equal(undefined, 'removed upload file 2');
    }));
});
