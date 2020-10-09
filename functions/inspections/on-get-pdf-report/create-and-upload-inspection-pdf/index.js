const assert = require('assert');
const JsPDF = require('./js-pdf');
const inspectionPdf = require('./inspection-pdf');
const inspectionUpload = require('../../api/utils/uploader');

/**
 * Generate a PDF from a property and inspection record
 * @param {Object} property
 * @param {Object} inspection
 * @return {Promise} - resolve {String} report download url
 */
module.exports = function createAndUploadInspection(property, inspection) {
  assert(Boolean(property), 'has property');
  assert(Boolean(inspection) && inspection.id, 'has inspection with id');

  const src = inspectionPdf(inspection, property);
  const steps = src.toSteps();
  const pdf = new JsPDF({ format: 'letter' });

  // Add steps to PDF
  for (let i = 0; i < steps.length; i++) {
    Object.keys(steps[i]).forEach(command => {
      let args = steps[i][command];
      if (!Array.isArray(args)) args = [args];
      pdf[command](...args);
    });
  }

  // Convert PDF source to buffer
  const output = toBuffer(pdf.output('arraybuffer'));

  // Upload tmp PDF file to S3
  return inspectionUpload.s3(
    output,
    `reports/${inspection.id}/${src.filename}`
  );
};

/**
 * Convert Array Buffer to Buffer
 * @param  {ArrayBuffer} ab
 * @return {Buffer}
 */
function toBuffer(ab) {
  const buf = new Buffer(ab.byteLength); // eslint-disable-line
  const view = new Uint8Array(ab);

  for (let i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }

  return buf;
}
