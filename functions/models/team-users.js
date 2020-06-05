const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const teamsModel = require('./teams');
const usersModel = require('./users');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: team-users:';

module.exports = modelSetup({
  /**
   * Remove a property from a team
   * and all that team's associated users
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreRemoveProperty(fs, teamId, propertyId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return fs
      .runTransaction(async transaction => {
        const queries = Promise.all([
          teamsModel.firestoreFindRecord(fs, teamId, transaction),
          usersModel.firestoreFindByTeam(fs, teamId, transaction),
        ]);

        let team = null;
        let teamDocSnap = null;
        let usersSnap = null;
        try {
          [teamDocSnap, usersSnap] = await queries; // eslint-disable-line
          team = teamDocSnap.data() || {};
        } catch (err) {
          throw Error(
            `${PREFIX} firestoreRemoveProperty: team/users lookup failed: ${err}`
          );
        }

        const batchOrTrans = batch || transaction;
        const isRemovingOnlyProperty =
          Object.keys(team.properties || {}).length === 1;
        const teamUpdate = {
          [`properties.${propertyId}`]: FieldValue.delete(),
        };
        const userUpdate = isRemovingOnlyProperty
          ? { [`teams.${teamId}`]: true }
          : { [`teams.${teamId}.${propertyId}`]: FieldValue.delete() }; // only remove nested property

        // Batch team update
        if (teamDocSnap.exists) {
          batchOrTrans.update(teamDocSnap.ref, teamUpdate);
        }

        // Batch each user's update
        usersSnap.forEach(({ ref: userRef }) =>
          batchOrTrans.update(userRef, userUpdate)
        );
      })
      .catch(err => {
        throw Error(
          `${PREFIX} firestoreRemoveProperty: transaction updates failed: ${err}`
        );
      });
  },
});
