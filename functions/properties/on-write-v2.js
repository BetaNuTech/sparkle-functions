const assert = require('assert');
const log = require('../utils/logger');
const teamUsersModel = require('../models/team-users');
const templatesModel = require('../models/templates');

const PREFIX = 'properties: on-write-v2:';

/**
 * Factory for property on write handler
 * @param  {admin.firestore} db - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteV2Handler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { propertyId } = event.params;
    if (!propertyId) {
      throw Error(`${PREFIX} missing parameter "propertyId"`);
    }

    const teamBatch = db.batch();
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const beforeTeam = beforeData.team || '';
    const afterTeam = afterData.team || '';
    const isTeamRemoved = beforeTeam && !afterTeam;
    const isTeamAdded = afterTeam && !beforeTeam;
    const isTeamUpdated = afterTeam && beforeTeam && afterTeam !== beforeTeam;
    const beforeTmplIds = Object.keys(beforeData.templates || {});
    const afterTmplIds = Object.keys(afterData.templates || {});
    const errors = [];

    if (isTeamRemoved) {
      try {
        await teamUsersModel.removeProperty(
          db,
          beforeTeam,
          propertyId,
          teamBatch
        );
        log.info(
          `${PREFIX} property: "${propertyId}" removed team: "${beforeTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to remove property team | ${err}`);
      }
    }

    if (isTeamAdded) {
      try {
        await teamUsersModel.addProperty(db, afterTeam, propertyId, teamBatch);
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
          db,
          beforeTeam,
          afterTeam,
          propertyId,
          teamBatch
        );
        log.info(
          `${PREFIX} property: "${propertyId}" updated team from: "${beforeTeam}" to: "${afterTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to update property team | ${err}`);
      }
    }

    // Commit team updates on their own batch, so a failed
    // template sync cannot roll them back, or vice versa
    try {
      await teamBatch.commit();
    } catch (err) {
      errors.push(Error(`${PREFIX} failed to commit team updates | ${err}`));
    }

    // Sync templates with latest property relationships.
    // Runs on every write, not only when the template set
    // changed: comparing key sets meant a sync that failed
    // once was never retried, leaving the template's
    // `properties` permanently stale and the template
    // hidden from both clients
    try {
      await templatesModel.updatePropertyRelationships(
        db,
        propertyId,
        beforeTmplIds,
        afterTmplIds
      );
    } catch (err) {
      errors.push(
        Error(
          `${PREFIX} failed to update Firestore templates relationship to property "${propertyId}" | ${err}`
        )
      );
    }

    // Surface any failure, having attempted every update
    if (errors.length) {
      errors.forEach(err => log.error(`${err}`));
      throw errors[0];
    }
  };
};
