const assert = require('assert');
const log = require('./logger');
const systemModel = require('../models/system');

const PREFIX = 'utils: auth-trello-request:';

/**
 * Creates a middleware instance to handle
 * lookup of Trello credentials and making sure
 * that requesting user has permission to acces them
 * before setting `req.trelloCredentials`
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - Express middleware
 */
module.exports = function authTrelloRequest(db) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);

  return async function middleware(req, res, next) {
    const { user } = req;

    if (!user) {
      log.error(`${PREFIX} user not defined on request`);
      res.status(500).send({ message: 'System failure' });
      return next(Error('improperly defined middleware'));
    }

    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrelloCredentials(db);

      if (!trelloCredentialsSnap.exists()) {
        res.status(409).send({ message: 'Trello credentials not created' });
        return next(Error('Database not populated'));
      }

      trelloCredentials = trelloCredentialsSnap.val();
    } catch (err) {
      log.error(`${PREFIX} Error accessing trello token: ${err}`);
      res.status(500).send({ message: 'Error accessing trello token' });
      return next(Error('Database failure'));
    }

    // Revoke unauthorized request for
    // anthor authorizor's Trello lists
    // if (user.id !== trelloCredentials.user) {
    //   res
    //     .status(401)
    //     .send({ message: 'User did not create authorization token' });
    //   return next(Error('User not authorized'));
    // }

    // Set Trello credentials on request
    req.trelloCredentials = req.trelloCredentials || Object.create(null);
    Object.assign(req.trelloCredentials, trelloCredentials);
    next();
  };
};
