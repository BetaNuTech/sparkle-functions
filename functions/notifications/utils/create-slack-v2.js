const assert = require('assert');
const propertiesModel = require('../../models/properties');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');

const PREFIX = 'notifications: utils: create-slack-v2';

/**
 * Create a Slack notification
 * @param  {admin.firestore} fs
 * @param  {String}  notificationId
 * @param  {Object}  notification
 * @return {Promise} - resolves {SlackNotificationResult}
 */
module.exports = async (fs, notificationId, notification) => {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
    userAgent,
    publishedMediums,
  } = notification;

  const publishedSlack = Boolean(publishedMediums && publishedMediums.slack);
  const configuredSlack = Boolean(notification.slack);

  // Slack notification previously configured
  if (publishedSlack || configuredSlack) {
    return null;
  }

  // Reject invalid notification
  if (!title) {
    throw Error(`${PREFIX} notification has invalid title: ${title}`);
  }
  if (!summary) {
    throw Error(`${PREFIX} notification has invalid summary: ${summary}`);
  }

  // Create Slack message from markdow or summary
  let message = markdownBody || summary;

  // Append any User agent to message
  if (userAgent) {
    message = `${message}
_${userAgent}_`; // Add Slack indent formatting
  }

  /**
   * Slack notification configuration
   * @type {SlackNotificationResult}
   * @param {String?} title - Optional title for admin notifications
   * @param {String} message
   * @param {String} channel
   */
  const result = {
    title: propertyId ? '' : title, // Title admin notifications only
    message,
    channel: '',
  };

  let channel = '';

  // Property notification
  if (propertyId) {
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      property = propertySnap.data();
      if (property) channel = property.slackChannel; // Set channel from property
    } catch (err) {
      throw Error(`${PREFIX} property lookup failed: ${err}`);
    }
  }

  // Admin notification
  if (!channel) {
    try {
      const slackOrgSnap = await integrationsModel.firestoreFindSlack(fs);
      const adminChannelName = (slackOrgSnap.data() || {}).defaultChannelName;
      if (adminChannelName) channel = adminChannelName;
    } catch (err) {
      throw Error(
        `${PREFIX} organization slack channel integration lookup failed: ${err}`
      );
    }
  }

  // Abandon undiscovered Slack channel by
  // marking slack medium as done publishing
  if (!channel) {
    try {
      await notificationsModel.firestoreUpdateRecord(fs, notificationId, {
        'publishedMediums.slack': true,
      });
    } catch (err) {
      throw Error(`${PREFIX} failed to update published mediums: ${err}`);
    }

    return null;
  }

  // Ensure channel `#` removed
  result.channel = channel.replace(/#/g, '');

  // Update notification record
  // with data to publish Slack message
  try {
    await notificationsModel.firestoreUpdateRecord(fs, notificationId, {
      slack: result,
      'publishedMediums.slack': false,
    });
  } catch (err) {
    throw Error(
      `${PREFIX} failed to update notification with Slack data: ${err}`
    );
  }

  return result;
};
