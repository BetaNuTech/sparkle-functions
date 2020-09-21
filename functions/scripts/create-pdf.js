const fs = require('fs');
const log = require('../utils/logger');
const { fs: db } = require('./setup'); // eslint-disable-line
const createReportPdf = require('../inspections/api/utils/report-pdf');
const propertiesModel = require('../models/properties');
const inspectionsModel = require('../models/inspections');

const [, , inspectionId] = process.argv; // eslint-disable-line
if (!inspectionId) {
  throw Error('Inspection ID not provided');
}

(async () => {
  let inspection = null;

  try {
    const inspectionSnap = await inspectionsModel.firestoreFindRecord(
      db,
      inspectionId
    );
    inspection = inspectionSnap.data() || null;
    if (!inspection || !inspection.property) throw Error('bad inspection');
  } catch (err) {
    log.error(`inspection not valid | ${err}`);
    throw err;
  }

  // Lookup property
  let property = null;
  try {
    const propertySnap = await propertiesModel.firestoreFindRecord(
      db,
      inspection.property
    );
    property = propertySnap.data() || null;
    if (!property) throw Error('bad inspection');
  } catch (err) {
    log.error(`property lookup failed | ${err}`);
    throw err;
  }

  const reportPdf = createReportPdf(inspection, property);

  let pdfBuffer = '';
  try {
    pdfBuffer = await reportPdf.generatePdf();
  } catch (err) {
    log.error(`PDF generation failed | ${err}`);
    throw err;
  }

  try {
    // Write report file
    await new Promise((resolve, reject) => {
      fs.writeFile('./report.pdf', pdfBuffer, { encoding: 'binary' }, function(
        err
      ) {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  } catch (err) {
    log.error(`PDF write failed | ${err}`);
    throw err;
  }

  log.info('Inspection Report PDF created successfully');
  process.exit();
})();