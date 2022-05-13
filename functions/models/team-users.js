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
   * @param  {admin.firestore} db
   * @param  {String} teamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  removeProperty(db, teamId, propertyId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return db
      .runTransaction(async transaction => {
        const queries = Promise.all([
          teamsModel.findRecord(db, teamId, transaction),
          usersModel.findByTeam(db, teamId, transaction),
        ]);

        let team = null;
        let teamDocSnap = null;
        let usersSnap = null;
        try {
          [teamDocSnap, usersSnap] = await queries; // eslint-disable-line
          team = teamDocSnap.data() || {};
        } catch (err) {
          throw Error(
            `${PREFIX} removeProperty: team/users lookup failed: ${err}`
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
          `${PREFIX} removeProperty: transaction updates failed: ${err}`
        );
      });
  },

  /**
   * Add a property to a team
   * and all team's associated users
   * @param  {admin.firestore} db
   * @param  {String} teamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  addProperty(db, teamId, propertyId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return db
      .runTransaction(async transaction => {
        const queries = Promise.all([
          teamsModel.findRecord(db, teamId, transaction),
          usersModel.findByTeam(db, teamId, transaction),
        ]);

        let teamDocSnap = null;
        let usersSnap = null;
        try {
          [teamDocSnap, usersSnap] = await queries; // eslint-disable-line
        } catch (err) {
          throw Error(
            `${PREFIX} addProperty: team/users lookup failed: ${err}`
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
          `${PREFIX} addProperty: transaction updates failed: ${err}`
        );
      });
  },

  /**
   * Update property's old/new
   * teams and users
   * @param  {admin.firestore} db
   * @param  {String} oldTeamId
   * @param  {String} newTeamId
   * @param  {String} propertyId
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async updateProperty(db, oldTeamId, newTeamId, propertyId, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(oldTeamId && typeof oldTeamId === 'string', 'has old team id');
    assert(newTeamId && typeof newTeamId === 'string', 'has new team id');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const batch = parentBatch || db.batch();

    // Remove property from old team/users
    try {
      await this.removeProperty(db, oldTeamId, propertyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} updateProperty: remove property batch failed: ${err}`
      );
    }

    // Add property to new team/users
    try {
      await this.addProperty(db, newTeamId, propertyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} updateProperty: add property batch failed: ${err}`
      );
    }

    if (parentBatch) {
      return parentBatch;
    }

    return batch.commit();
  },
});
