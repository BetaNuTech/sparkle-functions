const assert = require('assert');
const propertiesModel = require('../../models/properties');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');

const PREFIX = 'notifications: utils: create-slack';

/**
 * Create a Slack notification
 * @param  {firebase.database} db
 * @param  {String}  notificationId
 * @param  {Object}  notification
 * @return {Promise} - resolves {SlackNotificationResult}
 */
module.exports = async (db, notificationId, notification) => {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(
    notificationId && typeof notificationId === 'string',
    'has notification ID'
  );
  assert(
    notification && typeof notification === 'object',
    'has source notification'
  );

  const {
    title,
    summary,
    property: propertyId,
    markdownBody,
    publishedMediums,
  } = notification;

  // Slack notification previously configured
  if (publishedMediums && publishedMediums.slack) {
    return;
  }

  // Reject invalid source notification
  if (!title) {
    throw Error(`${PREFIX} source notification has invalid title: ${title}`);
  } else if (!summary) {
    throw Error(
      `${PREFIX} source notification has invalid summary: ${summary}`
    );
  }

  /**
   * Representation of Slack Notification
   * @type {SlackNotificationResult}
   * @param {String} title
   * @param {String} message
   * @param {String} channel
   * @param {String} path
   * @param {Object} publishedMediums
   */
  const result = {
    title,
    message: markdownBody || summary,
    channel: '',
    path: '',
    publishedMediums: {},
  };

  let channel = '';

  // Property notification
  if (propertyId) {
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.val();
      if (!property) throw Error('property does not exist');
    } catch (err) {
      throw Error(`${PREFIX} property lookup failed | ${err}`); // wrap error
    }

    channel = property.slackChannel;
  }

  // Admin notification
  if (!propertyId) {
    try {
      const slackOrgSnap = await integrationsModel.getSlackOrganization(db);
      const adminChannelName = (slackOrgSnap.val() || {}).defaultChannelName;
      if (adminChannelName) channel = adminChannelName;
    } catch (err) {
      throw Error(
        `${PREFIX} organization slack channel integration lookup failed | ${err}`
      ); // wrap error
    }
  }

  // Abandon when channel undiscovered
  if (!channel) {
    const message = propertyId
      ? 'No Slack channel associated with this property'
      : 'Admin channel has not been setup';
    throw Error(`${PREFIX} ${message}`);
  }

  // Ensure channel `#` removed
  result.channel = channel.replace(/#/g, '');

  // Create notification record
  // and queue notification sync task
  try {
    const notificationRef = await notificationsModel.addToSlackChannel(
      db,
      result.channel,
      notificationId,
      { title: result.title, message: result.message }
    );

    result.path = notificationRef.path.toString();
  } catch (err) {
    throw Error(
      `${PREFIX} failed to create and/or publish Slack notification | ${err}`
    );
  }

  // Update the source notifications publised mediums
  try {
    await notificationsModel.updateSrcPublishedMediums(db, notificationId, {
      slack: true,
    });
    result.publishedMediums.slack = true;
  } catch (err) {} // eslint-disable-line no-empty

  return result;
};
