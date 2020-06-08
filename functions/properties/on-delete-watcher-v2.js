const assert = require('assert');
const log = require('../utils/logger');
const diModel = require('../models/deficient-items');
const propertiesModel = require('../models/properties');
const teamUsersModel = require('../models/team-users');
const templatesModel = require('../models/templates');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'properties: on-delete-v2:';

/**
 * Factory for firestore property on delete handler
 * @param  {admin.firestore} fs - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @return {Function} - property onDelete handler
 */
module.exports = function createOnDeleteV2Handler(fs, storage) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(storage && typeof storage.bucket === 'function', 'has storage');

  return async (propertySnap, event) => {
    const { propertyId } = event.params;
    const batch = fs.batch();
    const property = propertySnap.data() || {};

    // Remove property's inspections
    let inspectionDocSnaps = [];
    try {
      const [
        activeInspDocSnaps,
        archivedInspDocSnaps,
      ] = await inspectionsModel.firestoreRemoveForProperty(
        fs,
        propertyId,
        batch
      );
      inspectionDocSnaps = [
        ...activeInspDocSnaps.docs,
        ...archivedInspDocSnaps.docs,
      ];
    } catch (err) {
      log.error(`${PREFIX} failed to remove inspections | ${err}`);
      throw err;
    }

    // Remove deficienct items
    let diDocSnaps = [];
    try {
      const [
        activeDiDocSnaps,
        archivedDiDocSnaps,
      ] = await diModel.firestoreRemoveForProperty(fs, propertyId, batch);
      diDocSnaps = [...activeDiDocSnaps.docs, ...archivedDiDocSnaps.docs];
    } catch (err) {
      log.error(`${PREFIX} failed to remove deficiencies | ${err}`);
      throw err;
    }

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
      throw err;
    }

    // Cleanup team/user associations
    if (property.team) {
      try {
        await teamUsersModel.firestoreRemoveProperty(
          fs,
          property.team,
          propertyId,
          batch
        );
      } catch (err) {
        log.error(`${PREFIX} team users cleanup failed | ${err}`);
        throw err;
      }
    }

    // Commit batched updates
    try {
      await batch.commit();
    } catch (err) {
      log.error(`${PREFIX} failed to commit updates | ${err}`);
      throw err;
    }

    // Cleanup deleted property's images
    const imgUrls = [property.photoURL, property.bannerPhotoURL].filter(
      Boolean
    );
    for (let i = 0; i < imgUrls.length; i++) {
      const url = imgUrls[i];

      try {
        await propertiesModel.deleteUpload(storage, url);
      } catch (err) {
        // Allow failure
        log.error(
          `${PREFIX} failed to delete property upload at ${url} | ${err}`
        );
      }
    }

    // Remove each inspection's item uploads
    for (let i = 0; i < inspectionDocSnaps.length; i++) {
      const inspDoc = inspectionDocSnaps[i];
      const insp = inspDoc.data() || {};
      const inspItemIds = Object.keys((insp.template || {}).items || {});

      // For each item, batch upload deletes
      for (let k = 0; k < inspItemIds.length; k++) {
        const itemId = inspItemIds[k];
        const item = insp.template.items[itemId];

        try {
          await inspectionsModel.deleteItemUploads(storage, item);
        } catch (err) {
          // Allow failure
          log.error(
            `${PREFIX} failed to delete inspection: "${inspDoc.id}" item: "${itemId}" uploads | ${err}`
          );
        }
      }
    }

    // Collect all deficiency completed image upload urls
    const completedDiPhotoUrls = diDocSnaps
      .reduce((acc, diDoc) => {
        const { completedPhotos } = diDoc.data() || {};

        Object.keys(completedPhotos || {}).forEach(photoId => {
          acc.push({
            deficiencyId: diDoc.id,
            url: completedPhotos[photoId].downloadURL,
          });
        });

        return acc;
      }, [])
      .filter(Boolean);

    // Remove each Deficency's completed photos
    for (let i = 0; i < completedDiPhotoUrls.length; i++) {
      const { deficiencyId, url } = completedDiPhotoUrls[i];
      try {
        await diModel.deleteUpload(storage, propertyId, deficiencyId, url);
      } catch (err) {
        // Allow failure
        log.error(
          `${PREFIX} failed to delete deficiency uploads at ${url} | ${err}`
        );
      }
    }
  };
};
