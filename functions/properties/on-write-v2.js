const assert = require('assert');
const log = require('../utils/logger');
const teamUsersModel = require('../models/team-users');
const templatesModel = require('../models/templates');

const PREFIX = 'properties: on-write-v2:';

/**
 * Factory for property on write handler
 * @param  {admin.firestore} fs - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteV2Handler(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { propertyId } = event.params;
    if (!propertyId) {
      throw Error(`${PREFIX} missing parameter "propertyId"`);
    }

    const batch = fs.batch();
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const beforeTeam = beforeData.team || '';
    const afterTeam = afterData.team || '';
    const isTeamRemoved = beforeTeam && !afterTeam;
    const isTeamAdded = afterTeam && !beforeTeam;
    const isTeamUpdated = afterTeam && beforeTeam && afterTeam !== beforeTeam;
    const beforeTmpl = Object.keys(beforeData.templates || {})
      .sort()
      .join('');
    const afterTmpl = Object.keys(afterData.templates || {})
      .sort()
      .join('');
    const hasUpdatedTemplates = beforeTmpl !== afterTmpl;

    if (isTeamRemoved) {
      try {
        await teamUsersModel.removeProperty(fs, beforeTeam, propertyId, batch);
        log.info(
          `${PREFIX} property: "${propertyId}" removed team: "${beforeTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to remove property team | ${err}`);
      }
    }

    if (isTeamAdded) {
      try {
        await teamUsersModel.addProperty(fs, afterTeam, propertyId, batch);
        log.info(
          `${PREFIX} property: "${propertyId}" added team: "${beforeTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to remove property team | ${err}`);
      }
    }

    if (isTeamUpdated) {
      try {
        await teamUsersModel.updateProperty(
          fs,
          beforeTeam,
          afterTeam,
          propertyId,
          batch
        );
        log.info(
          `${PREFIX} property: "${propertyId}" updated team from: "${beforeTeam}" to: "${afterTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to update property team | ${err}`);
      }
    }

    // Sync templates with
    // latest property relationships
    if (hasUpdatedTemplates) {
      try {
        await templatesModel.updatePropertyRelationships(
          fs,
          propertyId,
          beforeData ? Object.keys(beforeData.templates || {}) : [],
          afterData ? Object.keys(afterData.templates || {}) : [],
          batch
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed to update Firestore templates relationship to property "${propertyId}" | ${err}`
        );
      }
    }

    // Commit all updates
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} failed to commit batch updates | ${err}`);
    }
  };
};
