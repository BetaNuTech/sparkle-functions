const errorsService = require('../../services/errors');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'clients: api: post error:';

/**
 * Factory for client requested error report
 * @return {Function} - Express middleware
 */
module.exports = function createPostError() {
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
      await errorsService.report(message);
    } catch (err) {
      return send500Error(err, 'error failed to send', 'unexpected error');
    }

    // Send success
    res.status(201).send({ message: 'success' });
  };
};
