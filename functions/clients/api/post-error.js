const { ErrorReporting } = require('@google-cloud/error-reporting');
const config = require('../../config');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'clients: api: post error:';

/**
 * Factory for client requested error report
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
 */
module.exports = function createPostError() {
  const errors = new ErrorReporting({
    projectId: config.firebase.projectId,
    credentials: config.firebase.credentialJson,
  });

  /**
   * Handle POST request for generating
   * error report
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const hasValidMsg =
      Boolean(body.message) && typeof body.message === 'string';
    const hasValidUserAgent =
      Boolean(body.userAgent) && typeof body.userAgent === 'string';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject missing, required, error message
    if (!hasValidMsg) {
      return res.status(400).send({
        errors: [
          {
            detail: 'Bad Request: missing error "message" attribute',
          },
        ],
      });
    }

    if (!hasValidUserAgent) {
      return res.status(400).send({
        errors: [
          {
            detail: 'Bad Request: missing error "userAgent" attribute',
          },
        ],
      });
    }

    // Configure error message alonside user agent
    const message = `${body.message} (${body.userAgent})`;

    // Send error report
    try {
      await new Promise((resolve, reject) => {
        errors.report(message, err => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    } catch (err) {
      return send500Error(err, 'error failed to send', 'unexpected error');
    }

    // Send success
    res.status(201).send({ message: 'success' });
  };
};
