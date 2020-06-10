const moment = require('moment-timezone');
const isInspectionOverdue = require('./is-inspection-overdue');
const config = require('../../../config');

const INSP_PATH = config.clientApps.web.inspectionURL;

/**
 * Configure response JSON for an inspection
 * @param  {Date} date
 * @param  {String} propertyId
 * @param  {Object} latestInspection
 * @param  {String} latestInspectionId
 * @param  {String} timezone
 * @return {Object} - response JSON
 */
module.exports = function latestInspectionResponseData(
  date,
  propertyId,
  latestInspection,
  latestInspectionId,
  timezone
) {
  const currentTimeSecs = date.getTime() / 1000;
  const currentDay = currentTimeSecs / 60 / 60 / 24;
  const creationDateDay = latestInspection.creationDate / 60 / 60 / 24; // days since Unix Epoch
  const completionDateDay = latestInspection.completionDate / 60 / 60 / 24; // days since Unix Epoch
  const score = Math.round(Number(latestInspection.score));
  const inspectionURL = INSP_PATH.replace('{{propertyId}}', propertyId).replace(
    '{{inspectionId}}',
    latestInspectionId
  );
  const inspectionOverdue = isInspectionOverdue(
    currentDay,
    creationDateDay,
    completionDateDay
  );

  let alert = '';
  let complianceAlert = '';

  if (inspectionOverdue) {
    alert = 'Blueshift Product Inspection OVERDUE (Last: ';
    alert += moment(latestInspection.creationDate * 1000)
      .tz(timezone)
      .format('MM/DD/YY');
    alert += `, Completed: ${moment(latestInspection.completionDate * 1000)
      .tz(timezone)
      .format('MM/DD/YY')}).`;

    // Append extra alert for past max duration warning
    if (completionDateDay - creationDateDay > 3) {
      alert +=
        ' Over 3-day max duration, please start and complete inspection within 3 days.';
    }

    complianceAlert = alert;
  }

  // Less than 30 days ago, but Score less than 90%?
  if (score < 90) {
    if (alert) {
      alert += ' POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    } else {
      alert = 'POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    }
  }

  return {
    creationDate: moment(latestInspection.creationDate * 1000)
      .tz(timezone)
      .format('MM/DD/YY'),
    completionDate: moment(latestInspection.completionDate * 1000)
      .tz(timezone)
      .format('MM/DD/YY'),
    score: `${score}%`,
    inspectionReportURL: latestInspection.inspectionReportURL,
    alert: alert || undefined,
    complianceAlert: complianceAlert || undefined,
    inspectionURL,
  };
};
