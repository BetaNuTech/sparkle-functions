const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const storageHelper = require('../../../test-helpers/storage');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const archiveModel = require('../../../models/_internal/archive');
const teamsModel = require('../../../models/teams');
const templatesModel = require('../../../models/templates');
const diModel = require('../../../models/deficient-items');
const usersModel = require('../../../models/users');
const inspectionsModel = require('../../../models/inspections');
const { db, test, storage, cloudFunctions } = require('../../setup');
const jobsModel = require('../../../models/jobs');
const bidsModel = require('../../../models/bids');
const storageService = require('../../../services/storage');

describe('Properties | Delete | V2', () => {
  afterEach(() => cleanDb(db));

  it("should remove all property's inspections", async () => {
    const expected = false;
    const inspId = uuid();
    const propertyId = uuid();
    const propertyData = createProperty();
    const inspData = createInspection(propertyId);

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, inspId, inspData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await inspectionsModel.findRecord(db, inspId);
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await archiveModel.inspection.createRecord(db, inspId, inspData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await archiveModel.inspection.findRecord(db, inspId);
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, inspId, inspData);
    await diModel.createRecord(db, deficiencyId, deficiencyData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await diModel.findRecord(db, deficiencyId);
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, inspId, inspData);
    await archiveModel.deficientItem.createRecord(
      db,
      deficiencyId,
      deficiencyData
    );
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await archiveModel.deficientItem.findRecord(
      db,
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await templatesModel.upsertRecord(db, tmplOneId, tmplBefore);
    await templatesModel.upsertRecord(db, tmplTwoId, tmplBefore);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const results = await Promise.all([
      templatesModel.findRecord(db, tmplOneId),
      templatesModel.findRecord(db, tmplTwoId),
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await teamsModel.createRecord(db, teamId, teamData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await teamsModel.findRecord(db, teamId);
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
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await teamsModel.createRecord(db, teamId, teamData);
    await usersModel.createRecord(db, userId, userData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Results
    const result = await usersModel.findRecord(db, userId);
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
    const propertyDoc = propertiesModel.createDocRef(db, propertyId);
    const job = mocking.createJob({ property: propertyDoc });
    const jobDoc = jobsModel.createDocRef(db, jobId);
    const bid = mocking.createBid({ job: jobDoc });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);
    await jobsModel.createRecord(db, jobId, job);
    await bidsModel.createRecord(db, bidId, bid);

    // Execute
    const snap = await propertiesModel.findRecord(db, propertyId);
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const jobResult = await jobsModel.findRecord(db, jobId);
    const bidResult = await bidsModel.findRecord(db, jobId);
    const actual = [jobResult.data(), bidResult.data()];
    expect(actual).to.deep.equal(expected);
  });

  it("should remove a property's profile image from storage", async () => {
    const expected = undefined;
    const propertyId = uuid();
    const bucket = storage.bucket();
    const propertyData = createProperty();

    // Setup storage & database
    const {
      url,
      destination,
      directory,
    } = await storageHelper.uploadPropertyImage(bucket, propertyId);
    propertyData.photoURL = url;
    await propertiesModel.createRecord(db, propertyId, propertyData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

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
    const {
      url,
      destination,
      directory,
    } = await storageHelper.uploadPropertyImage(bucket, propertyId);
    propertyData.bannerPhotoURL = url;
    await propertiesModel.createRecord(db, propertyId, propertyData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

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
    const fileName = `${Math.round(Date.now() / 1000)}`;

    // Setup storage & database
    const fileBuffer = await storageHelper.createFileBuffer();
    const url = await storageService.inspectionItemUpload(
      storage,
      fileBuffer,
      inspectionId,
      itemId,
      fileName,
      'jpg'
    );

    Object.assign(
      inspData.template.items[itemId],
      { photosData: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, inspectionId, inspData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const directory = storageService.getInspectionItemUploadDir(
      inspectionId,
      itemId
    );
    const actual = await findStorageFile(bucket, directory, `${fileName}.jpg`); // find the upload
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
    const nowUnix = Math.round(Date.now() / 1000);
    const fileName = `${nowUnix}`;

    // Setup storage & database
    const fileBuffer = await storageHelper.createFileBuffer();
    const url = await storageService.inspectionItemUpload(
      storage,
      fileBuffer,
      inspectionId,
      itemId,
      fileName,
      'jpg'
    );

    Object.assign(
      inspData.template.items[itemId],
      { photosData: { [`${nowUnix}`]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await archiveModel.inspection.createRecord(db, inspectionId, inspData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDeleteV2);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const directory = storageService.getInspectionItemUploadDir(
      inspectionId,
      itemId
    );
    const actual = await findStorageFile(bucket, directory, `${fileName}.jpg`); // find the upload
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
    const {
      url,
      directory,
      destination,
    } = await storageHelper.uploadDeficiencyImage(
      bucket,
      propertyId,
      deficiencyId
    );
    Object.assign(
      deficiencyData,
      { completedPhotos: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await diModel.createRecord(db, deficiencyId, deficiencyData);
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

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
    const {
      url,
      directory,
      destination,
    } = await storageHelper.uploadDeficiencyImage(
      bucket,
      propertyId,
      deficiencyId
    );
    Object.assign(
      deficiencyData,
      { completedPhotos: { [Date.now()]: { downloadURL: url } } } // merge in photo data
    );
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await archiveModel.deficientItem.createRecord(
      db,
      deficiencyId,
      deficiencyData
    );
    const snap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.removeRecord(db, propertyId); // Remove property

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
