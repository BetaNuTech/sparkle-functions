const assert = require('assert');
const usersModel = require('../../models/users');
const notificationsModel = require('../../models/notifications');
const getRecepients = require('./get-push-recepients');

const PREFIX = 'notifications: utils: create-push-v2:';

/**
 * Create a push notification
 * @param  {admin.firestore} fs
 * @param  {String}  notificationId
 * @param  {Object}  notification
 * @return {Promise} - resolves {Object}
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
  const { title, summary, creator: creatorId, publishedMediums } = notification;

  // Reject invalid notification
  if (!title) {
    throw Error(`${PREFIX} notification has invalid title: ${title}`);
  }
  if (!summary) {
    throw Error(`${PREFIX} notification has invalid summary: ${summary}`);
  }

  const publishedPush = Boolean(publishedMediums && publishedMediums.push);
  const configuredPush = Boolean(notification.push);

  // Slack notification previously configured
  if (publishedPush || configuredPush) {
    return null;
  }

  // Lookup all users
  const users = [];
  try {
    const userDocs = await usersModel.firestoreFindAll(fs);
    userDocs.docs
      .filter(({ id }) => id !== creatorId) // remove notification creator
      .filter(doc => !(doc.data() || {}).pushOptOut)
      .forEach(userDoc => {
        const userId = userDoc.id;
        const user = userDoc.data();

        if (user && userId) {
          users.push({ id: userId, ...user });
        }
      });
  } catch (err) {
    throw Error(`${PREFIX} failed to get users: ${err}`);
  }

  // Collect all push recipents
  const property = notification.property || '';
  const recipientUserIds = getRecepients({
    users,
    allowCorp: Boolean(property),
    allowTeamLead: Boolean(property),
    property,
  });

  // Abandon push notifications for
  // notification without any recipients
  if (!recipientUserIds.length) {
    try {
      await notificationsModel.firestoreUpdateRecord(fs, notificationId, {
        'publishedMediums.push': true,
      });
    } catch (err) {
      throw Error(`${PREFIX} failed to update published mediums: ${err}`);
    }

    return null;
  }

  // Create push notification config
  // for each discovered recipient user
  const createdAt = Math.round(Date.now() / 1000);
  const result = recipientUserIds.reduce((acc, userId) => {
    acc[userId] = {
      title,
      createdAt,
      message: summary,
    };
    return acc;
  }, {});

  // Update notification record
  // with data for all push notifications
  try {
    await notificationsModel.firestoreUpdateRecord(fs, notificationId, {
      push: result,
      'publishedMediums.push': false,
    });
  } catch (err) {
    throw Error(
      `${PREFIX} failed to update notification with Slack data: ${err}`
    );
  }

  return result;
};
