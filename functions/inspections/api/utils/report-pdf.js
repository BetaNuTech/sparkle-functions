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
const LINE_LEFT_GUTTER = Math.max((settings.page.margin[0] || 0) + 2, 0);
const LINE_RIGHT_GUTTER = Math.max((settings.page.margin[3] || 0) - 2, 0);
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
    const logoSize = settings.images.appIcon.size;
    return [
      {
        columns: [
          {
            text: `${propertyName} | ${inspectorName} | ${this.creationDate}
  Template: ${templateName}`,
            style: 'header',
            width: settings.page.width - logoSize - rightGutter,
            margin: [leftGutter, topGutter, rightGutter, bottomGutter],
          },
          {
            image: settings.images.appIcon.src,
            margin: [0, topGutter - 4, rightGutter, bottomGutter],
            width: logoSize,
            height: logoSize,
          },
        ],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: LINE_LEFT_GUTTER,
            x2: settings.page.width - LINE_RIGHT_GUTTER,
            y1: 2,
            y2: 2,
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
   * PDF non-duplicate content
   * content unique to each page
   * @type {Object}
   */
  get content() {
    return [
      ...this.scoreContent,
      ...this.sectionsContent,
      // TODO: ...this.adminActivitySummaryContent
    ];
  },

  /**
   * Create Score for
   * content section
   * @return {Object[]}
   */
  get scoreContent() {
    const text = `Score: ${decimate(this._inspection.score)}%`;
    const color = this._inspection.deficienciesExist
      ? settings.colors.red.hex
      : settings.colors.blue.hex;
    return [
      {
        text,
        color,
        style: 'score',
        margin: settings.fonts.score.margin,
      },
    ];
  },

  /**
   * PDF steps for each inspection section
   * @return {Object[]}
   */
  get sectionsContent() {
    const template = Object.assign({}, this._inspection.template);
    const items = Object.keys(template.items).map(id =>
      Object.assign({ id }, template.items[id])
    );
    const sections = Object.keys(template.sections)
      .map(id => {
        const s = Object.assign({}, template.sections[id]);
        s.id = id;
        s.items = items
          .filter(({ sectionId }) => id === sectionId)
          .sort((a, b) => a.index - b.index);
        return s;
      })
      .sort((a, b) => a.index - b.index)
      .map(section => {
        const itemsContent = section.items
          .sort((a, b) => a.index - b.index)
          .map(
            item =>
              [].concat(
                this.getContentItemHeader(item),
                this.getContentItemBody(item)
              )
            // this.getItemInspectorNotes(item),
            // this.getItemAdminUpdates(item),
            // this.getItemPhotos(item),
          );

        return [].concat(
          this.getContentSectionHeader(section.title),
          ...itemsContent
        );
      });

    // flatten sections steps
    return [].concat(...sections);
  },

  /**
   * Create section header content
   * for a group of inspection items
   * @param  {String} text
   * @return {Object[]}
   */
  getContentSectionHeader(text) {
    assert(text && typeof text === 'string', 'has section header string');
    const bottomMargin = settings.fonts.sectionHeader.margin[3] || 0;
    const lineY = -1 * Math.max(bottomMargin - 1, 0);
    return [
      {
        text: `${(text || 'Unknown Section Name').toUpperCase()}`,
        style: 'sectionHeader',
        margin: settings.fonts.sectionHeader.margin,
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            x2: settings.page.width - LINE_RIGHT_GUTTER,
            y1: lineY,
            y2: lineY,
            lineColor: settings.colors.lightGray.hex,
            lineWidth: 0.5,
            lineCap: 'square',
          },
        ],
      },
    ];
  },

  /**
   * Create inspection item's header
   * @param  {Object} item
   * @return {Object[]}
   */
  getContentItemHeader(item) {
    assert(item && typeof item === 'object', 'has inspection item');
    const commands = [];
    const itemHeader = {
      text: '',
      style: 'item',
      margin: settings.fonts.item.margin,
    };

    if (item.isTextInputItem && item.isItemNA) {
      itemHeader.text = `${capitalize(item.title) || 'Untitled:'} NA`;
    } else if (item.isTextInputItem) {
      itemHeader.text = `${capitalize(item.title) || 'Untitled:'} ${
        item.textInputValue
      }`;
    } else if (item.isItemNA) {
      itemHeader.text = `${capitalize(item.title) || 'Untitled:'}`;
    } else if (item.itemType === 'signature') {
      // steps[0].setFontSize = pdfFonts.signatureItem.size;
      itemHeader.text = 'SIGNATURE';
      itemHeader.style = 'signatureItem';
      itemHeader.margin = settings.fonts.signatureItem.margin;
    } else if (`${item.mainInputType}`.toLowerCase() === 'oneaction_notes') {
      // steps[0].setFontSize = pdfFonts.note.size;
      itemHeader.text = item.mainInputNotes;
      itemHeader.style = 'note';
    } else {
      itemHeader.text = `${capitalize(item.title) || 'Untitled'}`;
    }

    commands.push(itemHeader);

    return commands;
  },

  /**
   * PDF steps for content's
   * inspection item body
   * @param  {Object} item
   * @return {Object[]}
   */
  getContentItemBody(item) {
    assert(item && typeof item === 'object', 'has inspection item');
    const itemId = item.id;
    const type = `${item.mainInputType || item.itemType}`.toLowerCase();
    const selectionIndex = item.mainInputSelection;
    const itemBody = {};

    if (!item.isTextInputItem && item.isItemNA) {
      itemBody.text = 'NA';
      itemBody.style = 'na';
    } else if (type === 'twoactions_checkmarkx') {
      itemBody.image =
        selectionIndex === 0
          ? settings.images.checkmarkItemIcon.src
          : settings.images.xItemIcon.src; // eslint-disable-line
    } else if (type === 'twoactions_thumbs') {
      itemBody.image =
        selectionIndex === 0
          ? settings.images.thumbsUpItemIcon.src
          : settings.images.thumbsDownItemIcon.src; // eslint-disable-line
    } else if (type === 'threeactions_checkmarkexclamationx') {
      if (selectionIndex === 0) {
        itemBody.image = settings.images.checkmarkItemIcon.src;
      } else if (selectionIndex === 1) {
        itemBody.image = settings.images.exclamationItemIcon.src;
      } else {
        itemBody.image = settings.images.xItemIcon.src;
      }
    } else if (type === 'threeactions_abc') {
      if (selectionIndex === 0) {
        itemBody.image = settings.images.aItemIcon.src;
      } else if (selectionIndex === 1) {
        itemBody.image = settings.images.bItemIcon.src;
      } else {
        itemBody.image = settings.images.cItemIcon.src;
      }
    } else if (type === 'fiveactions_onetofive') {
      if (selectionIndex === 0) {
        itemBody.image = settings.images.oneItemIcon.src;
      } else if (selectionIndex === 1) {
        itemBody.image = settings.images.twoItemIcon.src;
      } else if (selectionIndex === 2) {
        itemBody.image = settings.images.threeItemIcon.src;
      } else if (selectionIndex === 3) {
        itemBody.image = settings.images.fourItemIcon.src;
      } else {
        itemBody.image = settings.images.fiveItemIcon.src;
      }
    } else if (
      type === 'signature' &&
      this._itemAttachments[itemId] &&
      this._itemAttachments[itemId].signatureData
    ) {
      itemBody.image = this._itemAttachments[itemId].signatureData.datauri;
      itemBody.fit = [200, 125];
      itemBody.margin = settings.images.signature.margin;
    } else {
      // Notes do not have an item body
      return [];
    }

    return [itemBody];
  },

  /**
   * Name of inspection
   * @type {String}
   */
  get filename() {
    const date = new Date(parseInt(this._inspection.creationDate * 1000, 10)); // eslint-disable-line
    const creationDate = moment(date).format('YYYY-MM-DD');
    return `${this._property.name}_-_SparkleReport_-_${creationDate}.pdf`.replace(
      /\s/g,
      '_'
    ); // eslint-disable-line
  },

  /**
   * Formatted creation date
   * @type {String}
   */
  get creationDate() {
    const creationDate = new Date(
      parseInt(this._inspection.creationDate * 1000, 10)
    ); // eslint-disable-line
    return moment(creationDate).format('ddd, MMM D, YYYY');
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
 * @param  {Object?} itemAttachments
 * @return {Object} - inspection PDF instance
 */
module.exports = function createReportPdf(
  inspection,
  property,
  itemAttachments = {}
) {
  assert(
    inspection && typeof inspection === 'object',
    'reportPdf requires inspection model'
  );
  assert(
    property && typeof property === 'object',
    'reportPdf requires a property model'
  );
  assert(
    itemAttachments && typeof itemAttachments === 'object',
    'has item attachment data object'
  );

  return Object.create(prototype, {
    _inspection: { value: inspection },
    _property: { value: property },
    _itemAttachments: { value: itemAttachments },
  });
};

module.exports._proto = prototype;

/**
 * Convert a number to a percentage string
 * @param  {Number} factor
 * @param  {Number} divisor
 * @param  {Number} accuracy
 * @return {String} transfomed
 */
function decimate(factor, divisor = 100, accuracy = 1) {
  return ((factor / divisor) * 100).toFixed(accuracy || 0);
}

/**
 * Convert a string: Into A Title
 * @param  {String} str input
 * @return {String} transformed
 */
function capitalize(str) {
  return `${str}`
    .toLowerCase()
    .split(' ')
    .map(s => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
    .join(' ');
}
