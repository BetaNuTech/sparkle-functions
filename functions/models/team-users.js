const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const teamsModel = require('./teams');
const usersModel = require('./users');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: team-users:';

module.exports = modelSetup({
  /**
   * Remove a property from a team
   * and all team's associated users
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

          // Batch each user's update
          usersSnap.docs
            .filter(({ exists }) => exists)
            .forEach(({ ref: userRef }) =>
              batchOrTrans.update(userRef, userUpdate)
            );
        }
      })
      .catch(err => {
        throw Error(
          `${PREFIX} firestoreRemoveProperty: transaction updates failed: ${err}`
        );
      });
  },

  /**
   * Add a property to a team
   * and all team's associated users
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreAddProperty(fs, teamId, propertyId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return fs
      .runTransaction(async transaction => {
        const queries = Promise.all([
          teamsModel.firestoreFindRecord(fs, teamId, transaction),
          usersModel.firestoreFindByTeam(fs, teamId, transaction),
        ]);

        let teamDocSnap = null;
        let usersSnap = null;
        try {
          [teamDocSnap, usersSnap] = await queries; // eslint-disable-line
        } catch (err) {
          throw Error(
            `${PREFIX} firestoreAddProperty: team/users lookup failed: ${err}`
          );
        }

        const batchOrTrans = batch || transaction;
        const teamUpdate = { [`properties.${propertyId}`]: true };
        const userUpdate = { [`teams.${teamId}.${propertyId}`]: true };

        // Batch team update
        if (teamDocSnap.exists) {
          batchOrTrans.update(teamDocSnap.ref, teamUpdate);

          // Batch each user's update
          usersSnap.docs
            .filter(({ exists }) => exists)
            .forEach(({ ref: userRef }) =>
              batchOrTrans.update(userRef, userUpdate)
            );
        }
      })
      .catch(err => {
        throw Error(
          `${PREFIX} firestoreAddProperty: transaction updates failed: ${err}`
        );
      });
  },

  /**
   * Update property's old/new
   * teams and users
   * @param  {admin.firestore} fs
   * @param  {String} oldTeamId
   * @param  {String} newTeamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async firestoreUpdateProperty(
    fs,
    oldTeamId,
    newTeamId,
    propertyId,
    parentBatch
  ) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(oldTeamId && typeof oldTeamId === 'string', 'has old team id');
    assert(newTeamId && typeof newTeamId === 'string', 'has new team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const batch = parentBatch || fs.batch();

    // Add property to new team/users
    try {
      await this.firestoreAddProperty(fs, newTeamId, propertyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpdateProperty: add property batch failed: ${err}`
      );
    }

    // Remove property from old team/users
    try {
      await this.firestoreRemoveProperty(fs, oldTeamId, propertyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpdateProperty: remove property batch failed: ${err}`
      );
    }

    if (parentBatch) {
      return parentBatch;
    }

    return batch.commit();
  },
});
