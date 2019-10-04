const usersModel = require('../../models/users');
const notificationsModel = require('../../models/notifications');
const getRecepients = require('./get-push-recepients');

const PREFIX = 'notifications: utils: create-push:';

/**
 * Create a push notification
 * @param  {firebase.database} db
 * @param  {String}  notificationId
 * @param  {Object}  notification
 * @return {Promise} - resolves {CreateAllPushResult}
 */
module.exports = async (db, notificationId, notification) => {
  const creatorId = notification ? notification.creator || '' : '';
  const publishedMediums = notification ? notification.publishedMediums : null;

  if (!notification || !notification.title || !notification.summary) {
    throw Error(
      `${PREFIX} invalid source notification: "${JSON.stringify(notification)}"`
    );
  }

  // Push notifications previously configured
  if (publishedMediums && publishedMediums.push) {
    return { publishedMediums };
  }

  // Lookup all users
  const users = [];
  try {
    const usersSnap = await usersModel.findAll(db);
    const usersTree = usersSnap.val() || {};
    Object.keys(usersTree).forEach(userId => {
      const user = usersTree[userId];

      // Collect all users that
      // are not opting out of push
      // and didn't create the notification
      if (
        user &&
        typeof user === 'object' &&
        !user.pushOptOut &&
        userId !== creatorId
      ) {
        users.push(Object.assign({ id: userId }, user));
      }
    });
  } catch (err) {
    throw Error(`${PREFIX} failed to get users | ${err}`);
  }

  // Collect all push recipents
  const property = notification.property || '';
  const recipientIds = getRecepients({
    users,
    allowCorp: Boolean(property),
    allowTeamLead: Boolean(property),
    property,
  });

  // Create all notification configurations
  const { title, summary: message } = notification;
  const createdAt = Math.round(Date.now() / 1000);
  const pushNotifications = recipientIds.map(user => ({
    title,
    message,
    user,
    createdAt,
  }));

  // Atomically write all push notifications for all recipients
  let result = null;
  try {
    result = await notificationsModel.createAllPush(
      db,
      notificationId,
      pushNotifications
    );
  } catch (err) {
    throw Error(
      `${PREFIX} failed to write all push notifications to database | ${err}`
    );
  }

  return result;
};
