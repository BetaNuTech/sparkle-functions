const assert = require('assert');
const log = require('../../utils/logger');
// const config = require('../../config');
// const zipToTimezone = require('../../utils/zip-to-timezone');

const PREFIX = 'inspections: api: get-latest-completed:';
// const TEMP_NAME_LOOKUP = config.inspections.blueshiftTemplateName;

/**
 * Factory for getting the latest completed inspection
 * @param  {admin.firestore} fs
 * @return {Function} - Express handler
 */
module.exports = function createGetLatestCompletedInspection(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Lookup the latest completed inspection for a property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const propertyCode = params;
    // const otherDate = req.query.other_date;
    // const dateForInspection = otherDate
    //   ? new Date(otherDate).getTime() / 1000
    //   : 0;

    if (!propertyCode) {
      return res.status(400).send('Bad Request. Missing Parameters.'); // TODO: JSON API error
    }

    let propertySnap;
    try {
      // TODO: propertiesModel.firestoreQuery(fs, { code: ['==', propertyCode] })
      // propertySnap = await db
      //   .ref('properties')
      //   .orderByChild('code')
      //   .equalTo(propertyCode)
      //   .limitToFirst(1)
      //   .once('value');
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
      return res.status(500).send('Unable to retrieve data'); // TODO: JSON API error
    }

    if (!propertySnap.exists()) {
      return res.status(404).send('code lookup, not found.'); // TODO: JSON API error
    }

    // Get first and only property id from results
    // const [propertyId] = Object.keys(propertySnap.val());

    let inspectionsSnapshot;
    try {
      // TODO inspectionsModel.firestoreQuery(fs, {
      //   property: ['==', propertyId],
      //   inspectionCompleted: ['==', true],
      //   templateName: ['==', TEMP_NAME_LOOKUP],
      // })
      // inspectionsSnapshot = await db
      //   .ref('inspections')
      //   .orderByChild('property')
      //   .equalTo(propertyId)
      //   .once('value');
    } catch (err) {
      // Handle any errors
      log.error(`${PREFIX} ${err}`);
      res.status(500).send('No inspections found.'); // TODO: JSON API error
    }

    if (!inspectionsSnapshot.exists()) {
      return res.status(404).send('no inspections exist yet.'); // TODO: JSON API error
    }

    // const {
    //   latestInspection,
    //   latestInspectionId,
    //   latestInspectionByDate,
    //   latestInspectionByDateId,
    // } = findLatestInspectionData(inspectionsSnapshot, dateForInspection);

    // if (!latestInspection) {
    //   return res.status(404).send('No completed latest inspection found.');
    // }
    //
    // // Successful response
    // const property = propertySnap.val()[propertyId];
    // const propertyTimezone = zipToTimezone(property.zip);
    // const responseData = latestInspectionResponseData(
    //   new Date(),
    //   propertyId,
    //   latestInspection,
    //   latestInspectionId,
    //   propertyTimezone
    // );
    // if (latestInspectionByDate) {
    //   responseData.latest_inspection_by_date = latestInspectionResponseData(
    //     new Date(otherDate),
    //     propertyId,
    //     latestInspectionByDate,
    //     latestInspectionByDateId,
    //     propertyTimezone
    //   );
    // }

    // res.status(200).send(responseData);
  };
};
