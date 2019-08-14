const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, findStorageFile } = require('../../test-helpers/firebase');
const { db, test, storage, cloudFunctions } = require('./setup');

const SRC_PROFILE_IMG = 'test-image.jpg';
const PROP_UPLOAD_DIR = 'propertyImagesTest';
const INSP_UPLOAD_DIR = 'inspectionItemImagesTest';

describe('Property Delete', () => {
  afterEach(() => cleanDb(db));

  it("should remove a property's profile image from storage", async () => {
    const propertyId = uuid();
    const bucket = storage.bucket();

    // Setup database
    const destination = `${PROP_UPLOAD_DIR}/${propertyId}-${Date.now()}-${SRC_PROFILE_IMG}`;
    await bucket.upload(`${__dirname}/${SRC_PROFILE_IMG}`, {
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
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', photoURL: url }); // Create property /w profile
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, PROP_UPLOAD_DIR, destination); // find the profile
    expect(actual).to.equal(undefined);
  });

  it("should remove a property's banner image from storage", async () => {
    const propertyId = uuid();
    const bucket = storage.bucket();

    // Setup database
    let destination = `${PROP_UPLOAD_DIR}/${propertyId}-${Date.now()}-${SRC_PROFILE_IMG}`.split(
      '.'
    );
    destination = `${destination[0]}_banner.${destination[1]}`;
    await bucket.upload(`${__dirname}/${SRC_PROFILE_IMG}`, {
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
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', bannerPhotoURL: url }); // Create property /w banner
    const snap = await db.ref(`/properties/${propertyId}`).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    const actual = await findStorageFile(bucket, PROP_UPLOAD_DIR, destination); // find the banner
    expect(actual).to.equal(undefined);
  });

  it("should remove all a property's /inspections", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db
      .ref(`/inspections/${insp1Id}`)
      .set({ name: `name${insp1Id}`, property: propertyId });
    await db
      .ref(`/inspections/${insp2Id}`)
      .set({ name: `name${insp2Id}`, property: propertyId });
    await db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const paths = [`/inspections/${insp1Id}`, `/inspections/${insp2Id}`];
    const actual = await Promise.all(paths.map(p => db.ref(p).once('value')));

    // Assertions
    expect(actual.map(snap => snap.exists())).to.deep.equal([false, false]);
  });

  it("should remove all its' inspection's uploaded images from storage", async () => {
    const propertyId = uuid();
    const inspection1Id = uuid();
    const inspection2Id = uuid();
    const bucket = storage.bucket();

    // Setup database
    const destination1 = `${INSP_UPLOAD_DIR}/${inspection1Id}-${Date.now()}-${SRC_PROFILE_IMG}`;
    const destination2 = `${INSP_UPLOAD_DIR}/${inspection2Id}-${Date.now()}-${SRC_PROFILE_IMG}`;
    await bucket.upload(`${__dirname}/${SRC_PROFILE_IMG}`, {
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
    await bucket.upload(`${__dirname}/${SRC_PROFILE_IMG}`, {
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
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' }); // Create property
    // Create inspection #1
    await db.ref(`/inspections/${inspection1Id}`).set({
      name: inspection1Id,
      property: propertyId,
      template: {
        items: {
          [uuid()]: { photosData: { [Date.now()]: { downloadURL: url1 } } },
        },
      },
    });
    // Create inspection #2
    await db.ref(`/inspections/${inspection2Id}`).set({
      name: inspection2Id,
      property: propertyId,
      template: {
        items: {
          [uuid()]: { photosData: { [Date.now()]: { downloadURL: url2 } } },
        },
      },
    });
    const snap = await db.ref(`/properties/${propertyId}`).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(snap, { params: { propertyId } });

    // Test results
    let actual = await findStorageFile(bucket, INSP_UPLOAD_DIR, destination1); // find the upload
    expect(actual).to.equal(undefined, 'removed inspection 1 upload');

    actual = await findStorageFile(bucket, INSP_UPLOAD_DIR, destination2); // find the upload
    expect(actual).to.equal(undefined, 'removed inspection 2 upload');
  });

  it("should remove all a property's inspection proxies", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db
      .ref(`/inspections/${insp1Id}`)
      .set({ name: `name${insp1Id}`, property: propertyId }); // sanity check
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${insp1Id}`)
      .set({ name: `name${insp1Id}` });
    await db
      .ref(`/inspections/${insp2Id}`)
      .set({ name: `name${insp2Id}`, property: propertyId }); // sanity check
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${insp2Id}`)
      .set({ name: `name${insp2Id}` });
    await db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test results
    const paths = [
      `/propertyInspectionsList/${propertyId}/inspections/${insp1Id}`,
      `/propertyInspectionsList/${propertyId}/inspections/${insp2Id}`,
    ];
    const result = await Promise.all(paths.map(p => db.ref(p).once('value')));
    const actual = result.map(snap => snap.exists());

    // Assertions
    expect(actual).to.deep.equal([false, false]);
  });

  it("should remove all a deleted property's template proxies", async () => {
    const tmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `test${tmplId}` };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId]: true } }); // Add property with a template    await db.ref('/templates').set(expected);
    await db.ref(`/templates/${tmplId}`).set(templateData); // Add template
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId}`)
      .set(templateData); // Add propertyTemplatesList
    await db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it('should remove the deleted property from any team it is associated with', async () => {
    const teamId = uuid();
    const userId = uuid();
    const propertyId = uuid();
    const property2Id = uuid();

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', team: teamId }); // Add property
    await db.ref(`/teams/${teamId}/properties/${propertyId}`).set(true); // Add first property to team
    await db.ref(`/users/${userId}/teams/${teamId}/${propertyId}`).set(true); // add a user to the first team
    await db.ref(`/teams/${teamId}/properties/${property2Id}`).set(true); // Add second property to team
    await db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyDelete);
    await wrapped(propertyAfterSnap, { params: { propertyId } });

    // Test result
    const removedProperty = await db
      .ref(`/teams/${teamId}/properties/${propertyId}`)
      .once('value'); // check removed property is removed from team
    const otherProperty = await db
      .ref(`/teams/${teamId}/properties/${property2Id}`)
      .once('value'); // check other property is unaffected

    // Assertions
    expect(removedProperty.exists()).to.equal(
      false,
      `removed property from /teams/${teamId}/properties`
    );
    expect(otherProperty.exists()).to.equal(
      true,
      'second added property still exists on team'
    );
  });
});
