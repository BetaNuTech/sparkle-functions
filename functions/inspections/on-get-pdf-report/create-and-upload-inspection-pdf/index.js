const co = require('co');
const fs = require('fs');
const assert = require('assert');
const {promisify} = require('util');
const JsPDF = require('./js-pdf');
const inspectionPdf = require('./inspection-pdf');
const inspectionUpload = require('./inspection-upload');
const readFile = promisify(fs.readFile);

/**
 * Generate a PDF from a property and inspection record
 * @param {Object} property
 * @param {Object} inspection
 * @return {Promise} - resolve {String} report download url
 */
module.exports = function createAndUploadInspection(property, inspection) {
  return co(function *() {
    assert('has property', Boolean(property));
    assert('has inspection with id', Boolean(inspection) && inspection.id);

    const src = inspectionPdf(inspection, property);
    const steps = src.toSteps();
    const pdf = new JsPDF({format: 'letter'});
    // let pdfFile;

    // Add steps to PDF
    for (let i = 0; i < steps.length; i++) {
      Object.keys(steps[i]).forEach(command => {
        let args = steps[i][command];
        if (!Array.isArray(args)) args = [args];
        pdf[command](...args);
      });
    }

    // Convert PDF source to tmp file
    const output = toBuffer(pdf.output('arraybuffer'));
    // pdfFile = tmpFile(output, src.filename);
    // const tmpFilePath = await pdfFile.create();

    // Upload tmp PDF file to S3
    return inspectionUpload(
      output,
      `reports/${inspection.id}/${src.filename}`
    );
  });
}

/**
 * Convert Array Buffer to Buffer
 * @param  {ArrayBuffer} ab
 * @return {Buffer}
 */
function toBuffer(ab) {
  const buf = new Buffer(ab.byteLength);
  const view = new Uint8Array(ab);

  for (let i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }

  return buf;
}
