const path = require('path');
const assert = require('assert');
const moment = require('moment');
const PdfMake = require('pdfmake');
const settings = require('../../../config/report-pdf-settings');

const DOC_SETTINGS = Object.freeze({
  pageSize: {
    width: settings.page.width,
    height: settings.page.height,
  },

  defaultStyle: {
    font: settings.page.defaultFont,
  },
});
const fontDescriptors = {
  helvetica: {
    normal: path.join(__dirname, '/fonts/Helvetica.ttf'),
    bold: path.join(__dirname, '/fonts/Helvetica-Bold.ttf'),
    italics: path.join(__dirname, '/fonts/Helvetica-Italic.ttf'),
    bolditalics: path.join(__dirname, '/fonts/Helvetica-BoldItalic.ttf'),
  },
};
const pdfPrinter = new PdfMake(fontDescriptors);
const prototype = {
  /**
   * Create Binary PDF document
   * @return {Promise} - resolves {Buffer} PDF binary
   */
  generatePdf() {
    const chunks = [];
    const docDefinition = {
      ...DOC_SETTINGS,
      // TODO: Styles => Global Fonts
      // TODO: Metadata
      // TODO: Header
      // TODO: Footer
      ...{
        content: this.content,
      },
    };
    const doc = pdfPrinter.createPdfKitDocument(docDefinition);

    doc.on('data', chunk => chunks.push(chunk));

    return new Promise(resolve => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  },
};

/**
 * Create a PDFMake report representation
 * of an inspection record
 * @param  {Object} inspection
 * @param  {Object} property
 * @return {Object} - inspection PDF instance
 */
module.exports = function createReportPdf(inspection, property) {
  assert(Boolean(inspection), 'inspectionPdf requires inspection model');
  assert(Boolean(property), 'inspectionPdf requires a property model');

  return Object.create(prototype, {
    _inspection: { value: inspection },
    _property: { value: property },

    /**
     * PDF non-duplicate content
     * content unique to each page
     * @type {Object}
     */
    content: {
      get() {
        return [
          // TODO: ...this.scoreContent(),
          // TODO: ...this.sectionsContent(),
          // TODO: ...this.adminActivitySummaryContent()
        ];
      },
    },

    /**
     * Name of inspection
     * @type {String}
     */
    filename: {
      get() {
        const date = new Date(
          parseInt(this._inspection.creationDate * 1000, 10)
        ); // eslint-disable-line
        const creationDate = moment(date).format('YYYY-MM-DD');
        return `${this._property.name}_-_SparkleReport_-_${creationDate}.pdf`.replace(
          /\s/g,
          '_'
        ); // eslint-disable-line
      },
    },

    /**
     * Page counter
     * @type {Number}
     */
    page: {
      get: (function() {
        let page = 0;
        return () => (page += 1); // eslint-disable-line
      })(),
    },

    /**
     * Formatted creation date
     * @type {String}
     */
    creationDate: {
      get() {
        const creationDate = new Date(
          parseInt(this._inspection.creationDate * 1000, 10)
        ); // eslint-disable-line
        return moment(creationDate).format('ddd, MMM D, YYYY');
      },
    },
  });
};
