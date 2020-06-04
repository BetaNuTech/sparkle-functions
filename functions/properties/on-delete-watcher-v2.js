const assert = require('assert');
const log = require('../utils/logger');
const teamUsersModel = require('../models/team-users');
const templatesModel = require('../models/templates');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'properties: on-delete-v2:';
// const PROPERTY_BUCKET_NAME = `propertyImages${
//   process.env.NODE_ENV === 'test' ? 'Test' : ''
// }`;

/**
 * Factory for firestore property on delete handler
 * @param  {admin.firestore} fs - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @return {Function} - property onDelete handler
 */
module.exports = function createOnDeleteHandler(fs, storage) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(storage && typeof storage.bucket === 'function', 'has storage');

  return async (propertySnap, event) => {
    const { propertyId } = event.params;
    log.info(`${PREFIX} property "${propertyId}" deleted`);

    const batch = fs.batch();
    const property = propertySnap.data() || {};

    if (property.team) {
      try {
        await teamUsersModel.firestoreRemoveProperty(
          fs,
          propertyId,
          property.team,
          batch
        );
      } catch (err) {
        log.error(`${PREFIX} team users cleanup failed | ${err}`);
      }
    }

    // Remove property's inspections
    let inspectionDocSnaps = null;
    try {
      const [
        inspDocSnaps,
        archivedInspDocSnaps,
      ] = await inspectionsModel.firestoreRemoveForProperty(
        fs,
        propertyId,
        batch
      );
      inspectionDocSnaps = [...inspDocSnaps.docs, ...archivedInspDocSnaps];
    } catch (err) {
      log.error(`${PREFIX} failed to remove inspections | ${err}`);
    }

    // Remove deficienct items
    // TODO
    // try {
    //   await diModel.firestoreRemoveForProperty(fs, propertyId, batch);
    // } catch (err) {
    //   log.error(`${PREFIX} failed to remove deficiencies | ${err}`);
    // }

    // Remove Firestore templates
    // relationships with property
    try {
      await templatesModel.updatePropertyRelationships(
        fs,
        propertyId,
        Object.keys(property.templates || {}),
        [],
        batch
      );
    } catch (err) {
      log.error(
        `${PREFIX} failed to update Firestore templates relationship to property "${propertyId}" | ${err}`
      );
    }

    // Cleanup deleted property's images
    // const imgUrls = [property.photoURL, property.bannerPhotoURL].filter(
    //   Boolean
    // );
    //
    //
    // TODO: move to properties model
    // if (imgUrls.length) {
    //   for (let i = 0; i < imgUrls.length; i++) {
    //     const url = imgUrls[i];
    //     const imgType = ['profile', 'banner'][i];
    //
    //     try {
    //       const fileName = (decodeURIComponent(url).split('?')[0] || '')
    //         .split('/')
    //         .pop();
    //       await storage
    //         .bucket()
    //         .file(`${PROPERTY_BUCKET_NAME}/${fileName}`)
    //         .delete();
    //       log.info(
    //         `${PREFIX} property: ${propertyId} ${imgType} removal succeeded`
    //       );
    //     } catch (e) {
    //       log.error(
    //         `${PREFIX} property: ${propertyId} ${imgType} removal at ${url} failed ${e}`
    //       );
    //     }
    //   }
    // }

    // TODO remove deficient item's completed photos

    // Remove each inspection's iteam's uploads
    for (let i = 0; i < inspectionDocSnaps.length; i++) {
      const insp = inspectionDocSnaps[i].data() || {};
      const inspItemIds = Object.keys(insp.items || {});

      for (let k = 0; k < inspItemIds.length; k++) {
        const item = inspItemIds[k];
        await inspectionsModel.removeInspectionItemUploads(storage, item);
      }
    }
  };
};
