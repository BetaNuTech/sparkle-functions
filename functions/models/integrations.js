const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';
const TRELLO_PROPERTIES_PATH = '/integrations/trello/properties';

module.exports = modelSetup({
  /**
   * Lookup Trello integration setting for property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} trello integration
   */
  findByTrelloProperty(db, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    return db.ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}`).once('value');
  },

  /**
   * Archive all Trello property integrations
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resovles {DataSnapshot} property integrations snapshot
   */
  async archiveAllPropertyTrelloConfigs(db) {
    // Lookup all trello property integrations
    let propertyConfigsSnap = null;
    try {
      propertyConfigsSnap = await db.ref(TRELLO_PROPERTIES_PATH).once('value');
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: integrations lookup failed`
      );
    }

    // No updates needed
    if (!propertyConfigsSnap.exists()) {
      return null;
    }

    // Move trello integrations into archive
    try {
      await db
        .ref(`/archive${TRELLO_PROPERTIES_PATH}`)
        .set(propertyConfigsSnap.val());
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: archive write failed`
      );
    }

    // Destroy integrations for all properties
    try {
      await db.ref(TRELLO_PROPERTIES_PATH).remove();
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: integrations deletion failed`
      );
    }

    return propertyConfigsSnap;
  },

  /**
   * Lookup all notifications for Slack
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} notifications snapshot
   */
  findAllSlackNotifications(db) {
    return db.ref('/notifications/slack').once('value');
  },

  /**
   * Remove an individual Slack notification record
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} channelName
   * @param  {String} notificationId
   * @return {Promise} - resolves {DataSnapshot} notifications snapshot
   */
  removeSlackNotification(db, channelName, notificationId) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} has channel name`
    );
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} has notification ID`
    );
    return db
      .ref(`/notifications/slack/${channelName}/${notificationId}`)
      .remove();
  },
});
