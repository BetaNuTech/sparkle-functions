const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, storage, cloudFunctions } = require('./setup');

const SRC_PROFILE_IMG = 'property-profile.jpg';

describe('Property Delete', () => {
  afterEach(() => cleanDb(db));

  it('should remove a property\'s profile image from storage', () => co(function *() {
    const propertyId = uuid();
    const bucket =  storage.bucket();

    // Setup database
    const destination = `propertyImagesTest/${propertyId}-${Date.now()}-${SRC_PROFILE_IMG}`;
    yield bucket.upload(`${__dirname}/${SRC_PROFILE_IMG}`, { gzip: true, destination }); // upload file
    const uploadedFile = yield findPropertyImageFile(bucket, destination); // find the file
    const [url] = yield uploadedFile.getSignedUrl({ action: 'read', expires: '01-01-2491' }); // get download URL
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', photoURL: url }); // Create property /w profile
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    yield wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const actual = yield findPropertyImageFile(bucket, destination); // find the file
    expect(actual).to.equal(undefined);
  }));

  it('should remove all a property\'s /inspections', () => co(function *() {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    yield db.ref(`/inspections/${insp1Id}`).set({ name: `name${insp1Id}`, property: propertyId });
    yield db.ref(`/inspections/${insp2Id}`).set({ name: `name${insp2Id}`, property: propertyId });
    yield db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    yield wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const paths = [
      `/inspections/${insp1Id}`,
      `/inspections/${insp2Id}`
    ];
    const actual = yield Promise.all(paths.map(p => db.ref(p).once('value')));

    // Assertions
    expect(actual.map(snap => snap.exists())).to.deep.equal([false, false]);
  }));

  it('should remove all a property\'s /propertyInspectionsList proxies', () => co(function *() {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    yield db.ref(`/inspections/${insp1Id}`).set({ name: `name${insp1Id}`, property: propertyId }); // sanity check
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${insp1Id}`).set({ name: `name${insp1Id}` });
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${insp1Id}`).set({ name: `name${insp1Id}` });
    yield db.ref(`/inspections/${insp2Id}`).set({ name: `name${insp2Id}`, property: propertyId }); // sanity check
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${insp2Id}`).set({ name: `name${insp2Id}` });
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${insp2Id}`).set({ name: `name${insp2Id}` });
    yield db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    yield wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const paths = [
      `/propertyInspections/${propertyId}/inspections/${insp1Id}`,
      `/propertyInspectionsList/${propertyId}/inspections/${insp1Id}`,
      `/propertyInspections/${propertyId}/inspections/${insp2Id}`,
      `/propertyInspectionsList/${propertyId}/inspections/${insp2Id}`
    ];
    const actual = yield Promise.all(paths.map(p => db.ref(p).once('value')));

    // Assertions
    expect(actual.map(snap => snap.exists())).to.deep.equal([false, false, false, false]);
  }));

  it('should remove all a deleted property\'s /propertyTemplatesList proxies', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `test${tmplId}` };

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId]: true } }); // Add property with a template    yield db.ref('/templates').set(expected);
    yield db.ref(`/templates/${tmplId}`).set(templateData); // Add template
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).set(templateData); // Add propertyTemplates
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId}`).set(templateData); // Add propertyTemplatesList
    yield db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    yield wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, 'removed /propertyTemplates proxy');
    expect(actualList.exists()).to.equal(false, 'removed /propertyTemplatesList proxy');
  }));
});

/**
 * Find an image in the property images test bucket
 * @param  {firebaseAdmin.storage} bucket
 * @param  {String} fileName
 * @return {Promise} - resolves {Object} file reference
 */
function findPropertyImageFile(bucket, fileName) {
  return bucket.getFiles({ prefix: 'propertyImagesTest' })
    .then(([files]) =>
      files.filter(f => f.name.search(fileName) > -1)[0]
    );
}
