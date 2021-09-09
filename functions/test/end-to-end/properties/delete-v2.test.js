const path = require('path');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const archiveModel = require('../../../models/_internal/archive');
const teamsModel = require('../../../models/teams');
const templatesModel = require('../../../models/templates');
const diModel = require('../../../models/deficient-items');
const usersModel = require('../../../models/users');
const inspectionsModel = require('../../../models/inspections');
const { fs, test, storage, cloudFunctions } = require('../../setup');
const jobsModel = require('../../../models/jobs');
const bidsModel = require('../../../models/bids');

const SRC_PROFILE_IMG = 'test-image.jpg';
const PROFILE_IMG_PATH = path.join(__dirname, `../${SRC_PROFILE_IMG}`);
const PROP_UPLOAD_DIR = 'propertyImagesTest';
const INSP_UPLOAD_DIR = 'inspectionItemImagesTest';
const DEFICENT_UPLOAD_DIR = 'deficientItemImages';

describe('Properties | Delete | V2', () => {
  afterEach(() => cleanDb(null, fs));

  it("should remove all property's inspections", async () => {
    const expected = false;
    const inspId = uuid();
    const propertyId = uuid();
    const propertyData = createProperty();
    const inspData = createInspection(propertyId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, inspId, inspData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await inspectionsModel.firestoreFindRecord(fs, inspId);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove all property's archived inspections", async () => {
    const expected = false;
    const inspId = uuid();
    const propertyId = uuid();
    const propertyData = createProperty();
    const inspData = createInspection(propertyId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await archiveModel.inspection.firestoreCreateRecord(fs, inspId, inspData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await archiveModel.inspection.firestoreFindRecord(
      fs,
      inspId
    );
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove property's deficiencies", async () => {
    const expected = false;
    const inspId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const propertyData = createProperty();
    const inspData = createDeficientInspection(propertyId, itemId);
    const deficiencyData = createDeficientItem(propertyId, inspId, itemId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, inspId, inspData);
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await diModel.firestoreFindRecord(fs, deficiencyId);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove property's archived deficiencies", async () => {
    const expected = false;
    const inspId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const propertyData = createProperty();
    const inspData = createDeficientInspection(propertyId, itemId);
    const deficiencyData = createDeficientItem(propertyId, inspId, itemId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, inspId, inspData);
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove all property's relationships from templates", async () => {
    const propertyId = uuid();
    const tmplOneId = uuid();
    const tmplTwoId = uuid();
    const propertyData = createProperty({ templates: [tmplOneId, tmplTwoId] });
    const tmplBefore = createTemplate(propertyId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await templatesModel.firestoreUpsertRecord(fs, tmplOneId, tmplBefore);
    await templatesModel.firestoreUpsertRecord(fs, tmplTwoId, tmplBefore);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const results = await Promise.all([
      templatesModel.firestoreFindRecord(fs, tmplOneId),
      templatesModel.firestoreFindRecord(fs, tmplTwoId),
    ]);

    // Assertions
    [
      {
        actual: results[0].data(),
        expected: { ...tmplBefore, properties: [] },
        msg: 'Removed template one property association',
      },
      {
        actual: results[1].data(),
        expected: { ...tmplBefore, properties: [] },
        msg: 'Removed template two property association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should remove property's team relationship", async () => {
    const expected = false;
    const propertyId = uuid();
    const teamId = uuid();
    const propertyData = createProperty({ team: teamId });
    const teamData = createTeam(propertyId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await teamsModel.firestoreCreateRecord(fs, teamId, teamData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await teamsModel.firestoreFindRecord(fs, teamId);
    const actual = Boolean(
      ((result.data() || {}).properties || {})[propertyId]
    );

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove property's team users relationship", async () => {
    const expected = true;
    const propertyId = uuid();
    const teamId = uuid();
    const userId = uuid();
    const propertyData = createProperty({ team: teamId });
    const teamData = createTeam(propertyId);
    const userData = createUser(teamId, propertyId);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await teamsModel.firestoreCreateRecord(fs, teamId, teamData);
    await usersModel.firestoreCreateRecord(fs, userId, userData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = ((result.data() || {}).teams || {})[teamId];

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should remove all property's jobs and bids", async () => {
    const expected = [undefined, undefined];
    const propertyId = uuid();
    const jobId = uuid();
    const bidId = uuid();
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(fs, propertyId);
    const job = mocking.createJob({ property: propertyDoc });
    const jobDoc = jobsModel.createDocRef(fs, jobId);
    const bid = mocking.createBid({ job: jobDoc });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, property);
    await jobsModel.createRecord(fs, jobId, job);
    await bidsModel.createRecord(fs, bidId, bid);

    // Execute
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const jobResult = await jobsModel.findRecord(fs, jobId);
    const bidResult = await bidsModel.findRecord(fs, jobId);
    const actual = [jobResult.data(), bidResult.data()];
    expect(actual).to.deep.equal(expected);
  });

  it("should remove a property's profile image from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();

    // Setup storage & database
    const { url, destination, directory } = await uploadPropertyImage(
      bucket,
      propertyId
    );
    propertyData.photoURL = url;
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the profile
    expect(actual).to.equal(expected);
  });

  it("should remove a property's banner image from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();

    // Setup storage & database
    const { url, destination, directory } = await uploadPropertyImage(
      bucket,
      propertyId
    );
    propertyData.bannerPhotoURL = url;
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the profile
    expect(actual).to.equal(expected);
  });

  it("should remove property's inspection item uploads from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();
    const inspData = createInspection(propertyId, itemId);

    // Setup storage & database
    const { url, directory, destination } = await uploadInspectionItemImage(
      bucket,
      inspectionId
    );
    Object.assign(
      inspData.template.items[itemId],
      { photosData: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the upload
    expect(actual).to.equal(expected);
  });

  it("should remove property's archived inspection item uploads from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();
    const inspData = createInspection(propertyId, itemId);

    // Setup storage & database
    const { url, directory, destination } = await uploadInspectionItemImage(
      bucket,
      inspectionId
    );
    Object.assign(
      inspData.template.items[itemId],
      { photosData: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await archiveModel.inspection.firestoreCreateRecord(
      fs,
      inspectionId,
      inspData
    );
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the upload
    expect(actual).to.equal(expected);
  });

  it("should remove property's deficiency uploads from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const inspId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();
    const deficiencyData = createDeficientItem(propertyId, inspId, itemId);

    // Setup storage & database
    const { url, directory, destination } = await uploadDeficiencyImage(
      bucket,
      propertyId,
      deficiencyId
    );
    Object.assign(
      deficiencyData,
      { completedPhotos: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the upload
    expect(actual).to.equal(expected);
  });

  it("should remove property's archived deficiency uploads from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const inspId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();
    const deficiencyData = createDeficientItem(propertyId, inspId, itemId);

    // Setup storage & database
    const { url, directory, destination } = await uploadDeficiencyImage(
      bucket,
      propertyId,
      deficiencyId
    );
    Object.assign(
      deficiencyData,
      { completedPhotos: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    const snap = await propertiesModel.firestoreFindRecord(fs, propertyId);
    await propertiesModel.firestoreRemoveRecord(fs, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, directory, destination); // find the upload
    expect(actual).to.equal(expected);
  });
});

function createInspection(propertyId, itemId) {
  const mockConfig = { property: propertyId };

  if (itemId) {
    mockConfig.template = {
      items: {
        [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx'),
      },
    };
  }

  return mocking.createInspection(mockConfig);
}

function createDeficientInspection(propertyId, itemId) {
  return mocking.createInspection({
    property: propertyId,
    inspectionCompleted: true,
    template: {
      trackDeficientItems: true,
      // Create template w/ 1 deficient item
      items: {
        [itemId]: mocking.createCompletedMainInputItem(
          'twoactions_checkmarkx',
          true
        ),
      },
    },
  });
}

function createDeficientItem(propertyId, inspectionId, itemId) {
  return {
    ...mocking.createDeficientItem(inspectionId, itemId),
    property: propertyId,
  };
}

function createProperty(config = {}) {
  const finalConfig = JSON.parse(JSON.stringify(config));

  if (config.templates && Array.isArray(config.templates)) {
    finalConfig.templates = {};
    config.templates.forEach(tmplId => {
      finalConfig.templates[tmplId] = true;
    });
  }

  return {
    name: 'test',
    ...finalConfig,
  };
}

function createTemplate(...propertyIds) {
  const result = {
    name: 'template-test',
  };

  if (Array.isArray(propertyIds)) {
    result.properties = [...propertyIds];
  }

  return result;
}

function createTeam(propertyId) {
  return {
    name: 'test-team',
    properties: { [propertyId]: true },
  };
}

function createUser(teamId, propertyId) {
  const result = {
    firstName: 'test',
    lastName: 'user',
  };
  if (teamId) result.teams = { [teamId]: true };
  if (propertyId) result.teams[teamId] = { [propertyId]: true };

  return result;
}

async function uploadPropertyImage(bucket, propertyId) {
  const destination = `${PROP_UPLOAD_DIR}/${propertyId}-${Date.now()}${uuid().replace(
    '-',
    ''
  )}-${SRC_PROFILE_IMG}`;
  await bucket.upload(PROFILE_IMG_PATH, {
    gzip: true,
    destination,
  }); // upload file
  const uploadedFile = await findStorageFile(
    bucket,
    PROP_UPLOAD_DIR,
    destination
  ); // find the file
  const [url] = await uploadedFile.getSignedUrl({
    action: 'read',
    expires: '01-01-2491',
  }); // get download URL
  return { url, directory: PROP_UPLOAD_DIR, destination };
}

async function uploadInspectionItemImage(bucket, inspectionId) {
  const destination = `${INSP_UPLOAD_DIR}/${inspectionId}-${Date.now()}-${SRC_PROFILE_IMG}`;
  await bucket.upload(PROFILE_IMG_PATH, {
    gzip: true,
    destination,
  }); // upload file
  const uploadedFile = await findStorageFile(
    bucket,
    INSP_UPLOAD_DIR,
    destination
  ); // find the file
  const [url] = await uploadedFile.getSignedUrl({
    action: 'read',
    expires: '01-01-2491',
  }); // get download URL
  return { url, directory: INSP_UPLOAD_DIR, destination };
}

async function uploadDeficiencyImage(bucket, propertyId, deficiencyId) {
  const destination = `${DEFICENT_UPLOAD_DIR}/${propertyId}/${deficiencyId}/${SRC_PROFILE_IMG}`;
  await bucket.upload(PROFILE_IMG_PATH, {
    gzip: true,
    destination,
  }); // upload file
  const uploadedFile = await findStorageFile(
    bucket,
    DEFICENT_UPLOAD_DIR,
    destination
  ); // find the file
  const [url] = await uploadedFile.getSignedUrl({
    action: 'read',
    expires: '01-01-2491',
  }); // get download URL
  return { url, directory: DEFICENT_UPLOAD_DIR, destination };
}
