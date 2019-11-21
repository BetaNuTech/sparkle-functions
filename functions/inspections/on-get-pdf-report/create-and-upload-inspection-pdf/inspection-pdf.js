const assert = require('assert');
const cloneDeep = require('lodash/cloneDeep');
const moment = require('moment');
const {
  pdfVerticals,
  pdfImages,
  pdfFonts,
  pdfColors,
} = require('./inspection-pdf-settings');

const { assign } = Object;

const LEFT_GUTTER = 12;
const RIGHT_GUTTER = 204;

const prototype = {
  /**
   * Sets the mete data of the PDF document
   * @return {Object[]}
   */
  getMetaData() {
    return [
      {
        addMetadata: [
          `${this._property.name || 'Property'}: ${this.creationDate}`,
          'title',
        ],
      }, // eslint-disable-line
      { addMetadata: ['Sparkle Report', 'subject'] }, // eslint-disable-line
      {
        addMetadata: [
          `${this._inspection.inspectorName || 'Inspector Unknown'}`,
          'author',
        ],
      }, // eslint-disable-line
    ];
  },

  /**
   * Set the default settings of PDF
   * @return {Object[]}
   */
  getPdfDefaults() {
    return [
      { setFont: 'helvetica' },
      // Set page background
      { setFillColor: [255, 255, 255] },
      { rect: [0, 0, 612, 792, 'F'] },
    ];
  },

  /**
   * PDF steps for page header
   * @return {Object[]}
   */
  getHeader() {
    const subHeader = [
      `${this._property.name || 'Unknown Property'} | `,
      `${this._inspection.inspectorName || 'Inspector Unknown'} | `,
      `${this.creationDate}`,
    ];

    const imgSize = 10.75;

    return [
      { setFontSize: pdfFonts.header.size },
      { setFontType: pdfFonts.header.weight },
      { setFontStyle: pdfFonts.header.style },
      {
        text: [LEFT_GUTTER, 0, 'Sparkle Report'],
        _vertical: 'headerTitle',
      }, // eslint-disable-line
      {
        text: [LEFT_GUTTER, 0, subHeader.join('')],
        _vertical: 'headerSubTitle',
      },
      {
        addImage: [
          pdfImages.appIcon,
          'PNG',
          RIGHT_GUTTER - 11,
          10,
          imgSize,
          imgSize,
        ],
      }, // eslint-disable-line
      { setLineWidth: 1 },
      { setDrawColor: pdfColors.black },
      { line: [LEFT_GUTTER, 0, RIGHT_GUTTER, 0], _vertical: 'headerLine' },
    ];
  },

  /**
   * PDF steps for page footer
   * @return {Object[]}
   */
  getFooter() {
    const page = `${this.page}`;

    return [
      { setFontSize: pdfFonts.pageNumber.size },
      { setFontType: pdfFonts.pageNumber.weight },
      { setFontStyle: pdfFonts.pageNumber.style },
      { text: [RIGHT_GUTTER - 2 * page.length, 263, page] },
    ];
  },

  /**
   * PDF steps for inspection score
   * @return {Object[]}
   */
  getScore() {
    return [
      { setFontSize: pdfFonts.score.size },
      { setFontType: pdfFonts.score.weight },
      { setFontStyle: pdfFonts.score.style },
      {
        setTextColor: this._inspection.deficienciesExist
          ? pdfColors.red
          : pdfColors.blue,
      }, // eslint-disable-line
      {
        text: [LEFT_GUTTER, 0, `Score: ${decimate(this._inspection.score)}%`],
        _vertical: 'score',
      }, // eslint-disable-line
      { setTextColor: pdfColors.black }, // Revert color to default
    ];
  },

  /**
   * PDF steps for each inspection section
   * @return {Object[]}
   */
  getSections() {
    const template = assign({}, this._inspection.template);
    const items = Object.keys(template.items).map(id =>
      assign({ id }, template.items[id])
    );
    const sections = Object.keys(template.sections)
      .map(id => {
        const s = assign({}, template.sections[id]);
        s.id = id;
        s.items = items
          .filter(({ sectionId }) => id === sectionId)
          .sort((a, b) => a.index - b.index);
        return s;
      })
      .sort((a, b) => a.index - b.index)
      .map(section => {
        const itemsCmds = section.items.map(item =>
          [].concat(
            this.getItemHeader(item),
            this.getItemBody(item),
            this.getItemInspectorNotes(item),
            this.getItemAdminUpdates(item),
            this.getItemPhotos(item),
            [{ _placeholder: true, _vertical: 'itemEnd' }]
          )
        );

        return [].concat(this.getSectionHeader(section.title), ...itemsCmds, [
          { _placeholder: true, _vertical: 'sectionEnd' },
        ]);
      });

    // flatten sections steps
    return [].concat(...sections);
  },

  /**
   * PDF steps for an inspection section header
   * @param {String} title
   * @return {Object[]}
   */
  getSectionHeader(title) {
    const segments = this._splitOverflowText(
      `${(title || 'Unknown Section Name').toUpperCase()}`,
      [LEFT_GUTTER, 0],
      43
    ) // eslint-disable-line
      .map(segment => {
        segment._vertical = 'sectionHeader';
        return segment;
      });

    return [
      { setFontSize: pdfFonts.sectionHeader.size },
      { setFontType: pdfFonts.sectionHeader.weight },
      { setFontStyle: pdfFonts.sectionHeader.style },
      ...segments,
      { setLineWidth: 0.1 },
      { setDrawColor: pdfColors.lightGray },
      {
        line: [LEFT_GUTTER, 0, RIGHT_GUTTER, 0],
        _vertical: 'sectionHeaderLine',
      },
    ];
  },

  /**
   * PDF steps for an inspection item header
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemHeader(item) {
    const steps = [
      { setFontSize: pdfFonts.item.size },
      { setFontType: pdfFonts.item.weight },
      { setFontStyle: pdfFonts.item.style },
    ];

    let text = '';

    if (item.isTextInputItem && item.isItemNA) {
      text = `${capitalize(item.title) || 'Untitled:'} NA`;
    } else if (item.isTextInputItem) {
      text = `${capitalize(item.title) || 'Untitled:'} ${item.textInputValue}`;
    } else if (item.isItemNA) {
      text = `${item.title || 'Untitled:'}`;
    } else if (item.itemType === 'signature') {
      steps[0].setFontSize = pdfFonts.signatureItem.size;
      steps[1].setFontType = pdfFonts.signatureItem.weight;
      steps[2].setFontStyle = pdfFonts.signatureItem.style;
      text = 'SIGNATURE';
    } else if (`${item.mainInputType}`.toLowerCase() === 'oneaction_notes') {
      steps[0].setFontSize = pdfFonts.note.size;
      steps[1].setFontType = pdfFonts.note.weight;
      steps[2].setFontStyle = pdfFonts.note.style;
      text = item.mainInputNotes;
    } else {
      text = `${capitalize(item.title) || 'Untitled'}`;
    }

    const segments = this._splitOverflowText(text, [LEFT_GUTTER, 0], 74).map(
      segment => {
        segment._vertical = 'itemHeader';
        return segment;
      }
    );

    steps.push(...segments);

    if (!item.isTextInputItem && item.isItemNA) {
      steps.push(
        { setFontSize: pdfFonts.na.size },
        { setFontType: pdfFonts.na.weight },
        { setFontStyle: pdfFonts.na.style },
        { text: [LEFT_GUTTER + 3, 0, 'NA'], _vertical: 'itemNAHeader' }
      );
    }

    return steps;
  },

  /**
   * PDF steps for an inspection item body
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemBody(item) {
    const type = `${item.mainInputType || item.itemType}`.toLowerCase();
    const selectionIndex = item.mainInputSelection;
    const addImage = ['', 'PNG', LEFT_GUTTER + 3, 0, 8, 8];

    if (type === 'twoactions_checkmarkx') {
      addImage[0] =
        selectionIndex === 0
          ? pdfImages.checkmarkItemIcon
          : pdfImages.xItemIcon; // eslint-disable-line
    } else if (type === 'twoactions_thumbs') {
      addImage[0] =
        selectionIndex === 0
          ? pdfImages.thumbsUpItemIcon
          : pdfImages.thumbsDownItemIcon; // eslint-disable-line
    } else if (type === 'threeactions_checkmarkexclamationx') {
      if (selectionIndex === 0) {
        addImage[0] = pdfImages.checkmarkItemIcon;
      } else if (selectionIndex === 1) {
        addImage[0] = pdfImages.exclamationItemIcon;
      } else {
        addImage[0] = pdfImages.xItemIcon;
      }
    } else if (type === 'threeactions_abc') {
      if (selectionIndex === 0) {
        addImage[0] = pdfImages.aItemIcon;
      } else if (selectionIndex === 1) {
        addImage[0] = pdfImages.bItemIcon;
      } else {
        addImage[0] = pdfImages.cItemIcon;
      }
    } else if (type === 'fiveactions_onetofive') {
      if (selectionIndex === 0) {
        addImage[0] = pdfImages.oneItemIcon;
      } else if (selectionIndex === 1) {
        addImage[0] = pdfImages.twoItemIcon;
      } else if (selectionIndex === 2) {
        addImage[0] = pdfImages.threeItemIcon;
      } else if (selectionIndex === 3) {
        addImage[0] = pdfImages.fourItemIcon;
      } else {
        addImage[0] = pdfImages.fiveItemIcon;
      }
    } else if (type === 'signature' && item.signatureData) {
      return this.getSignatureImage(item.signatureData.datauri);
    } else {
      // Notes do not have an item body
      return [];
    }

    return [{ addImage, _vertical: 'itemBodyImage' }];
  },

  /**
   * Steps to render PDF inspection notes
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemInspectorNotes(item) {
    const notes = item.inspectorNotes;
    const segments = this._splitOverflowText(notes, [LEFT_GUTTER + 10, 0], 100) // eslint-disable-line
      .map(segment => {
        segment._vertical = 'inspectionNote';
        return segment;
      });

    if (notes) {
      return [
        { setFontSize: pdfFonts.noteTitle.size },
        { setFontStyle: pdfFonts.noteTitle.style },
        { setFontType: pdfFonts.noteTitle.weight },
        {
          text: [LEFT_GUTTER + 10, 0, 'Inspector Notes:'],
          _vertical: 'inspectionNoteHeader',
        }, // eslint-disable-line
        { _placeholder: true, _vertical: 'inspectionNoteHeaderPost' },
        { setFontSize: pdfFonts.note.size },
        { setFontType: pdfFonts.note.weight },
        { setFontStyle: pdfFonts.note.style },
        ...segments,
      ];
    }
    return [];
  },

  /**
   * Steps to render PDF item admin updates
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemAdminUpdates(item) {
    const adminEdits = Object.keys(item.adminEdits || {})
      .map(id => item.adminEdits[id])
      .sort((a, b) => a.edit_date - b.edit_date)
      .map(e =>
        [
          moment(new Date(parseInt(e.edit_date * 1000, 10))).format(
            'M/D/YY, h:mm A:'
          ),
          e.admin_name,
          `${e.action}.`,
        ].join(' ')
      );

    const segments = []
      .concat(
        ...adminEdits.map(text =>
          this._splitOverflowText(text, [LEFT_GUTTER + 10, 0], 100)
        ) // eslint-disable-line
      )
      .map(segment => {
        segment._vertical = 'itemAdminEdit';
        return segment;
      });

    if (adminEdits.length) {
      return [
        { setFontSize: pdfFonts.noteTitle.size },
        { setFontStyle: pdfFonts.noteTitle.style },
        { setFontType: pdfFonts.noteTitle.weight },
        {
          text: [LEFT_GUTTER + 10, 0, 'Admin Edits:'],
          _vertical: 'itemAdminEditHeader',
        }, // eslint-disable-line
        { setFontSize: pdfFonts.note.size },
        { setFontType: pdfFonts.note.weight },
        { setFontStyle: pdfFonts.note.style },
        ...segments,
      ];
    }
    return [];
  },

  /**
   * Steps to render PDF item photos
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemPhotos(item) {
    const pxToMm = 2.941176471;
    const photos = Object.keys(item.photosData || {})
      .map(timestamp => {
        const photo = assign({}, item.photosData[timestamp]);
        timestamp = parseInt(timestamp, 10);
        photo.timestamp = timestamp ? timestamp * 1000 : Date.now();
        return photo;
      })
      .filter(photo => Boolean(photo.downloadURL)) // require downloadURL
      .sort((a, b) => a.timestamp - b.timestamp); // oldest to newest

    if (photos.length) {
      return [
        { setDrawColor: pdfColors.black },
        ...photos.map(photo => ({
          addImage: [
            photo.datauri,
            `${photo.type || 'PNG'}`.toUpperCase(),
            LEFT_GUTTER + 10,
            0,
            Math.round(photo.width / pxToMm),
            Math.round(photo.height / pxToMm),
          ],
          _vertical: 'itemPhoto',
        })),
      ];
    }
    return [];
  },

  /**
   * Create a signature image from data URI
   * @param  {String} datauri
   * @return {Object[]}
   */
  getSignatureImage(datauri) {
    return [
      {
        addImage: [datauri, 'PNG', LEFT_GUTTER, 0, 70.5, 20.8],
        _vertical: 'itemSignature',
      },
    ];
  },

  /**
   * Steps to render the summary of Admin activity
   * @return {Object[]}
   */
  getAdminActivitySummary() {
    const editsByAuthor = {};

    /*
     * Flat array of each edit performed on all items
     */
    const adminEdits = [].concat(
      ...Object.keys(this._inspection.template.items).map(id => {
        const item = this._inspection.template.items[id];

        if (!item.adminEdits) return [];

        // Convert edits hash to array
        return Object.keys(item.adminEdits || {}).map(
          editId => item.adminEdits[editId]
        );
      })
    );

    /*
     * Increment each admin edit to `editsByAuthor`
     */
    adminEdits
      .filter(edit => Boolean(edit.admin_name))
      .forEach(edit => {
        if (!editsByAuthor[edit.admin_name]) {
          editsByAuthor[edit.admin_name] = 0;
        }

        editsByAuthor[edit.admin_name]++;
      });

    if (Object.keys(editsByAuthor).length) {
      return [
        { setFontSize: pdfFonts.summaryHeader.size },
        { setFontStyle: pdfFonts.summaryHeader.style },
        { setFontType: pdfFonts.summaryHeader.weight },
        { setTextColor: pdfColors.lightBlue },
        {
          text: [LEFT_GUTTER, 0, 'Summary of Admin Activity'],
          _vertical: 'adminSummaryHeader',
        }, // eslint-disable-line
        { setLineWidth: 0.5 },
        { setDrawColor: pdfColors.lightGray },
        {
          line: [LEFT_GUTTER, 0, RIGHT_GUTTER, 0],
          _vertical: 'adminSummaryLine',
        }, // eslint-disable-line
        { setFontSize: pdfFonts.item.size },
        { setFontStyle: pdfFonts.item.style },
        { setFontType: pdfFonts.item.weight },
        { setTextColor: pdfColors.black },
        ...Object.keys(editsByAuthor).map(author => ({
          text: [
            LEFT_GUTTER + 4,
            0,
            `${author} made a total of ${editsByAuthor[author]} edit${
              editsByAuthor[author] > 1 ? 's' : ''
            }.`, // eslint-disable-line
          ],
          _vertical: 'adminSummaryItem',
        })),
      ];
    }
    return [];
  },

  /**
   * Split a string of text into text steps
   * of the maxmium allowable line length
   * @param  {String} text
   * @param  {Number[]} defaults
   * @param  {Number} maxLen
   * @return {Object[]}
   */
  _splitOverflowText(text, defaults = [LEFT_GUTTER, 0], maxLen = 200) {
    const str = `${text}`.split(/\s/g);
    let line = [].concat(defaults, ['']);
    const steps = [];

    while (str.length) {
      let nextWord = str[0];

      if (nextWord.length >= maxLen) {
        str[0] = nextWord.slice(maxLen);
        nextWord = nextWord.slice(0, maxLen);
        str.unshift(nextWord);
      }

      const canAppendNextWord = line[2].length + nextWord.length <= maxLen;

      if (canAppendNextWord) {
        line[2] += `${line[2].length > 0 ? ' ' : ''}${str.shift()}`;
      }

      if (!canAppendNextWord || !str.length) {
        steps.push({ text: [].concat(line) });
        line = [].concat(defaults, ['']);
      }
    }

    return steps;
  },

  /**
   * Apply vertical PDF settings to steps and add pages as necessary
   * @param  {Object[]} steps
   * @param  {Object} settings
   * @return {Object[]} steps
   */
  applyPdfVerticals(
    steps,
    settings = { pageHeight: 300, pageCutoffBuffer: 10 }
  ) {
    let cursor = 0;
    let result = [];
    let page = [].concat(steps);
    let lastStyleCommands = [];
    let lastVerticalCommand = 0;
    const { pageHeight, pageCutoffBuffer } = settings;

    for (let i = 0, l = page.length; i < l; i++) {
      const command = page[i];
      const type = command._vertical;

      if (!command._vertical) {
        /*
         * Reset style commands when new style chain started
         */
        if (i > 0 && lastVerticalCommand + 1 === i) {
          lastStyleCommands = [];
        }

        lastStyleCommands.push(i);
        continue; // eslint-disable-line no-continue
      }

      assert(
        settings[type],
        `applyPdfVerticals() command: ${type} configured vertical settings`
      );

      let { top = 0, height = 0 } = settings[type]; // eslint-disable-line

      /*
       * Use any image height if not pre-defined
       */
      if (!height && command.addImage) {
        height = command.addImage[5] || 0;
      }

      /*
       * Add a new page for overflowing content
       */
      if (top + height + cursor + pageCutoffBuffer >= pageHeight) {
        result = result.concat(page.slice(0, lastVerticalCommand + 1));
        page = [].concat(
          this.getFooter(),
          [
            { addPage: [] },
            // Set page background
            { setFillColor: [255, 255, 255] },
            { rect: [0, 0, 612, 792, 'F'] },
          ],
          this.getHeader(),
          [{ _placeholder: true, _vertical: 'pageCutBuffer' }],
          lastStyleCommands.map(index => cloneDeep(page[index])), // eslint-disable-line
          page.slice(i)
        );

        i = 0;
        l = page.length;
        cursor = 0;
        lastVerticalCommand = 0;
        continue; // eslint-disable-line no-continue
      }

      cursor += top;

      if (command.text) {
        command.text[1] = cursor;
      } else if (command.line) {
        command.line[1] = cursor;
        command.line[3] = cursor;
      } else if (command.addImage) {
        command.addImage[3] = cursor;
      }

      cursor += height;
      lastVerticalCommand = i;
    }

    result = result.concat(page, this.getFooter());
    return result;
  },

  /**
   * Control high-level step order of PDF
   * @return {Object[]}
   */
  toSteps() {
    return this.applyPdfVerticals(
      [].concat(
        this.getMetaData(),
        this.getPdfDefaults(),
        this.getHeader(),
        this.getScore(),
        this.getSections(),
        this.getAdminActivitySummary()
      ),
      pdfVerticals
    )
      .filter(cmd => Boolean(cmd._placeholder) === false)
      .map(cmd => {
        if (cmd._vertical) delete cmd._vertical;
        return cmd;
      });
  },
};

/**
 * Create a jsPDF steps representation of an inspection record
 * @param  {Object} inspection
 * @param  {Object} property
 * @return {Object} - inspection PDF instance
 */
module.exports = function createInspectionPdf(inspection, property) {
  assert(Boolean(inspection), 'inspectionPdf requires inspection model');
  assert(Boolean(property), 'inspectionPdf requires a property model');

  return Object.create(prototype, {
    _inspection: { value: inspection },
    _property: { value: property },

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
        return `${this._property.name}_-_InspectionReport_-_${creationDate}.pdf`.replace(
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
