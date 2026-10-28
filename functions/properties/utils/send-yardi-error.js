const assert = require('assert');
const log = require('../../utils/logger');
const create500ErrHandler = require('../../utils/unexpected-api-error');

/**
 * Factory for a handler that converts coded
 * Yardi service errors into JSON API responses
 * @param  {String} prefix - log prefix
 * @param  {Express.Response} res
 * @return {Function} - handler
 */
module.exports = function createYardiErrorHandler(prefix, res) {
  assert(prefix && typeof prefix === 'string', 'has log prefix');
  assert(Boolean(res), 'has Express response instance');
  const send500Error = create500ErrHandler(prefix, res);

  /**
   * Send the response for a Yardi error
   * @param  {Error} err
   * @param  {String} userMsg - fallback message for unexpected errors
   */
  return (err, userMsg) => {
    assert(err instanceof Error, 'has error instance');
    assert(userMsg && typeof userMsg === 'string', 'has user message');
    if (err.code) log.error(`${prefix} | ${err}`);
    res.set('Content-Type', 'application/vnd.api+json');

    switch (err.code) {
      // Bad property code
      case 'ERR_NO_YARDI_PROPERTY':
        return res.status(404).send({
          errors: [
            {
              detail: 'Configured yardi code for property returned no results',
              source: { pointer: 'code' },
            },
          ],
        });

      // Unknown work order ID
      case 'ERR_NO_YARDI_WORK_ORDER':
        return res.status(404).send({
          errors: [
            {
              detail: 'Work order does not exist for property in Yardi',
              source: { pointer: 'workOrderId' },
            },
          ],
        });

      // Property not enabled for the interface in Voyager
      case 'ERR_YARDI_PROPERTY_NOT_CONFIGURED':
        return res.status(403).send({
          errors: [
            {
              detail:
                'Yardi interface is not configured for this property in Voyager',
              source: { pointer: 'code' },
            },
          ],
        });

      // Bad system integration credentials
      case 'ERR_BAD_YARDI_CREDENTIALS':
        return res.status(407).send({
          errors: [
            {
              detail: 'Yardi integration credentials not accepted',
            },
          ],
        });

      // Yardi rejected the work order's content
      case 'ERR_YARDI_WORK_ORDER_REJECTED':
        return res.status(400).send({
          errors: (err.details && err.details.length
            ? err.details
            : ['Yardi rejected work order']
          ).map(detail => ({ detail, source: { pointer: 'workOrder' } })),
        });

      // Yardi rejected the attachment (bad extension, unknown type)
      case 'ERR_YARDI_ATTACHMENT_REJECTED':
        return res.status(400).send({
          errors: (err.details && err.details.length
            ? err.details
            : ['Yardi rejected attachment']
          ).map(detail => ({ detail, source: { pointer: 'attachment' } })),
        });

      // Yardi could not read the request
      case 'ERR_YARDI_SOAP_FAULT':
        return res.status(502).send({
          errors: [
            {
              detail: 'Yardi could not process the request, please try again',
            },
          ],
        });

      default:
        return send500Error(err, 'Yardi request failed', userMsg);
    }
  };
};
