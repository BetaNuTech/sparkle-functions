const log = require('../../utils/logger');
const propertiesModel = require('../../models/properties');

const PREFIX = 'properties: middleware: property-code:';

/**
 * Factory for middleware to lookup
 * a property and verify that it has
 * a usable code
 * @param {admin.firestore} fs
 * @return {Function} - onRequest handler
 */

module.exports = fs => async (req, res, next) => {
  const { params } = req;
  const { propertyId } = params;
  let property = null;

  // Lookup requested property
  try {
    if (!propertyId) throw Error('no property ID provided');
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    if (!propertyDoc.exists) throw Error('property does not exist');
    property = propertyDoc.data();
  } catch (err) {
    log.error(`${PREFIX} ${err}`);
    next(err);
    return res.status(404).send({
      errors: [
        {
          detail: 'property does not exist',
        },
      ],
    });
  }

  // Reject property /wo Yardi code
  if (!property.code) {
    next(Error('Property missing code'));
    return res.status(403).send({
      errors: [
        {
          detail: 'Property code not set for Yardi request',
          source: { pointer: 'code' },
        },
      ],
    });
  }

  req.property = property;
  next();
};
