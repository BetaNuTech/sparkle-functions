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

  pageMargins: settings.page.margin,

  defaultStyle: {
    font: settings.page.defaultFont,
  },

  styles: settings.fonts,
});
const fontDescriptors = {
  helvetica: {
    normal: path.join(__dirname, '/fonts/Helvetica.ttf'),
    bold: path.join(__dirname, '/fonts/Helvetica-Bold.ttf'),
    italics: path.join(__dirname, '/fonts/Helvetica-Italic.ttf'),
    bolditalics: path.join(__dirname, '/fonts/Helvetica-BoldItalic.ttf'),
  },
  helveticaMedium: {
    normal: path.join(__dirname, '/fonts/Helvetica-Medium.ttf'),
  },
};
const pdfPrinter = new PdfMake(fontDescriptors);
const prototype = {
  /**
   * Generate PDF report's meta data
   * @return {Object}
   */
  get metaData() {
    return {
      title: `${this._property.name || 'Property'}: ${this.creationDate}`,
      subject: 'Sparkle Report',
      author: `${this._inspection.inspectorName || 'Inspector Unknown'}`,
    };
  },

  /**
   * Generate Page Headers
   * @return {Object[]}
   */
  get header() {
    const propertyName = this._property.name || 'Unknown Property';
    const inspectorName = this._inspection.inspectorName || 'Inspector Unknown';
    const templateName = this._inspection.templateName || 'Unknown Template';
    const topGutter = settings.header.margin[1] || 0;
    const bottomGutter = settings.header.margin[3] || 0;
    const leftGutter = settings.header.margin[0] || 0;
    const rightGutter = settings.header.margin[2] || 0;
    return [
      {
        columns: [
          {
            text: `${propertyName} | ${inspectorName} | ${this.creationDate}
  Template: ${templateName}`,
            style: 'header',
            width: settings.page.width - settings.header.logoSize - rightGutter,
            margin: [leftGutter, topGutter, rightGutter, bottomGutter],
          },
          {
            image: settings.images.appIcon,
            margin: [0, topGutter, rightGutter, bottomGutter],
            width: settings.header.logoSize,
            height: settings.header.logoSize,
          },
        ],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: leftGutter + 2,
            x2: settings.page.width - rightGutter - 2,
            y1: 0,
            y2: 0,
            lineColor: settings.colors.black.hex,
            lineWidth: 3,
            lineCap: 'square',
          },
        ],
      },
    ];
  },

  /**
   * PDF Footer (page number) text
   * @return {Function}
   */
  get footer() {
    return (currentPage /* , pageCount */) => [
      {
        text: `${currentPage}`,
        style: 'footer',
        alignment: 'right',
        margin: settings.footer.margin,
      },
    ];
  },

  /**
   * Create Binary PDF document
   * @return {Promise} - resolves {Buffer} PDF binary
   */
  generatePdf() {
    const chunks = [];
    const docDefinition = {
      ...DOC_SETTINGS,
      ...{
        info: this.metaData,
        header: this.header,
        footer: this.footer,
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
          // TODO: ...this.createScoreContent(),
          // TODO: ...this.createSectionsContent(),
          // TODO: ...this.createAdminActivitySummaryContent()
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
