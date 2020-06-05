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
    const isTeamUpdated = afterTeam && beforeTeam && !afterTeam !== beforeTeam;

    if (isTeamRemoved) {
      try {
        await teamUsersModel.firestoreRemoveProperty(
          fs,
          beforeTeam,
          propertyId,
          batch
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
        await teamUsersModel.firestoreAddProperty(
          fs,
          afterTeam,
          propertyId,
          batch
        );
        log.info(
          `${PREFIX} property: "${propertyId}" added team: "${beforeTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to remove property team | ${err}`);
      }
    }

    if (isTeamUpdated) {
      try {
        await teamUsersModel.firestoreUpdateProperty(
          fs,
          beforeTeam,
          afterTeam,
          propertyId,
          batch
        );
        log.info(
          `${PREFIX} property: "${propertyId}" updated to team: "${beforeTeam}"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to update property team | ${err}`);
      }
    }

    // Remove old team / property association
    // TODO: Delete
    // if (beforeTeam && beforeTeam !== afterTeam) {
    //   try {
    //     // Remove old property from team record
    //     await db.ref(`/teams/${beforeTeam}/properties/${propertyId}`).set(null);
    //
    //     // Queue update of removed team's users
    //     const usersInBeforeTeam = await usersModel.findByTeam(db, beforeTeam);
    //     usersInBeforeTeam.forEach(userID => {
    //       userUpdateQueue.push(userID);
    //     });
    //   } catch (e) {
    //     log.error(
    //       `${PREFIX} property: ${propertyId} remove from team: ${beforeTeam} - failed: ${e}`
    //     );
    //   }
    // }

    // TODO: Delete
    // if (afterTeam) {
    //   try {
    //     // Add new property to team record
    //     await db.ref(`/teams/${afterTeam}/properties/${propertyId}`).set(true);
    //
    //     // Queue update of new team's users
    //     const usersInAfterTeam = await usersModel.findByTeam(db, afterTeam);
    //     usersInAfterTeam.forEach(userID => {
    //       userUpdateQueue.push(userID);
    //     });
    //   } catch (e) {
    //     log.error(
    //       `${PREFIX} property: ${propertyId} upsert to team: ${afterTeam} - failed: ${e}`
    //     );
    //   }
    // }

    // Queue update to all users
    // with changed teams
    // TODO: Delete
    // userUpdateQueue
    //   .filter((userID, i, all) => all.indexOf(userID) === i) // unique only
    //   .forEach(userID => publisher.publish(Buffer.from(userID)));

    // Sync templates with
    // latest property relationships
    // TODO check for property/template changes
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

    // Commit all updates
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} failed to commit batch updates | ${err}`);
    }
  };
};
