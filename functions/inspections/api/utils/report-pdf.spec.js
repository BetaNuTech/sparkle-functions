const { expect } = require('chai');
const moment = require('moment');
const createReportPdf = require('./report-pdf');
const uuid = require('../../../test-helpers/uuid');
const settings = require('../../../config/report-pdf-settings');
const mocking = require('../../../test-helpers/mocking');

const MAIN_INPUTS = {
  checkmark: 'twoactions_checkmarkx',
  thumbs: 'twoactions_thumbs',
  exclamation: 'threeactions_checkmarkexclamationx',
  abc: 'threeactions_abc',
  oneToFive: 'fiveactions_onetofive',
};

describe('Inspections | API | Utils | Report PDF', function() {
  it('generates a pdf buffer of inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const instance = createReportPdf(inspection, property);
    const result = await instance.generatePdf();
    const actual = Buffer.isBuffer(result);
    expect(actual).to.equal(true);
  });

  it('provides a descriptive filename', () => {
    const creationDate = 1577880000;
    const formattedDate = moment(creationDate * 1000).format('YYYY-MM-DD');
    const expected = `prop_-_SparkleReport_-_${formattedDate}.pdf`;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      creationDate,
    });
    const property = mocking.createProperty({
      name: 'prop',
      inspections: [inspectionId],
    });
    const instance = createReportPdf(inspection, property);
    const actual = instance.filename;
    expect(actual).to.equal(expected);
  });

  it('formats inspections creation date', () => {
    const creationDate = 1577880000;
    const expected = moment(creationDate * 1000).format('ddd, MMM D, YYYY');
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      creationDate,
    });
    const property = mocking.createProperty({
      name: 'prop',
      inspections: [inspectionId],
    });
    const instance = createReportPdf(inspection, property);
    const actual = instance.creationDate;
    expect(actual).to.equal(expected);
  });

  it('creates PDF metadata', () => {
    const creationDate = 1577880000;
    const formattedDate = moment(creationDate * 1000).format(
      'ddd, MMM D, YYYY'
    );
    const expected = {
      title: `prop: ${formattedDate}`,
      subject: 'Sparkle Report',
      author: 'test user',
    };
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      inspectorName: 'test user',
      creationDate,
    });
    const property = mocking.createProperty({
      name: 'prop',
      inspections: [inspectionId],
    });
    const instance = createReportPdf(inspection, property);
    const actual = instance.metaData;
    expect(actual).to.deep.equal(expected);
  });

  it('converts an inspection score to a content score percentage', () => {
    const expected = `Score: 85.5%`;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 85.5,
    });
    const property = mocking.createProperty({
      name: 'prop',
      inspections: [inspectionId],
    });
    const instance = createReportPdf(inspection, property);
    const { text: actual } = instance.scoreContent[0] || {};
    expect(actual).to.equal(expected);
  });

  it('set content score color from blue to red if deficiencies exist', () => {
    const expected = [settings.colors.blue.hex, settings.colors.red.hex];
    const propertyId = uuid();
    const inspection1Id = uuid();
    const inspection2Id = uuid();
    const sufficientInsp = mocking.createInspection({
      property: propertyId,
      score: 100,
      deficienciesExist: false,
    });
    const deficientInsp = mocking.createInspection({
      property: propertyId,
      score: 50,
      deficienciesExist: true,
    });
    const property = mocking.createProperty({
      name: 'prop',
      inspections: [inspection1Id, inspection2Id],
    });
    const instance1 = createReportPdf(sufficientInsp, property);
    const { color: defaultColor } = instance1.scoreContent[0] || {};
    const instance2 = createReportPdf(deficientInsp, property);
    const { color: deficientColor } = instance2.scoreContent[0] || {};
    const actual = [defaultColor, deficientColor];
    expect(actual).to.deep.equal(expected);
  });

  it('creates an item header for all item types', () => {
    const tests = [
      {
        data: { isTextInputItem: true, isItemNA: true, title: 'txt' },
        expected: 'text: Txt NA | style: item',
        msg: 'created text item NA header',
      },
      {
        data: { isTextInputItem: true, textInputValue: 'value', title: 'txt' },
        expected: 'text: Txt value | style: item',
        msg: 'created text item header',
      },
      {
        data: { isItemNA: true, title: 'na' },
        expected: 'text: Na | style: item',
        msg: 'created text item header',
      },
      {
        data: { itemType: 'signature' },
        expected: 'text: SIGNATURE | style: signatureItem',
        msg: 'created signature item header',
      },
      {
        data: { mainInputType: 'oneaction_notes', mainInputNotes: 'Main Note' },
        expected: 'text: Main Note | style: note',
        msg: 'created main input note item header',
      },
      {
        data: { title: 'default main item' },
        expected: 'text: Default Main Item | style: item',
        msg: 'created default main item header',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const item = data.isTextInputItem
        ? mocking.createItem({ ...data, sectionId: '1' })
        : mocking.createCompletedMainInputItem(
            MAIN_INPUTS.checkmark,
            false,
            data
          );
      const [layout] = createReportPdf._proto.getContentItemHeader(item);
      const result = layout.columns ? layout.columns[1] : layout;
      const actual = `text: ${result.text} | style: ${result.style}`;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('creates an item body content for all item types', () => {
    const tests = [
      {
        data: { mainInputType: MAIN_INPUTS.checkmark, mainInputSelection: 0 },
        expected: settings.images.checkmarkItemIcon.src,
        msg: 'created checkmark image for 1st checkmarkx selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.checkmark, mainInputSelection: 1 },
        expected: settings.images.xItemIcon.src,
        msg: 'created x image for 2nd checkmarkx selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.thumbs, mainInputSelection: 0 },
        expected: settings.images.thumbsUpItemIcon.src,
        msg: 'created thumbs up image for 1st thumbs selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.thumbs, mainInputSelection: 1 },
        expected: settings.images.thumbsDownItemIcon.src,
        msg: 'created thumbs down image for 2nd thumbs selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.exclamation, mainInputSelection: 0 },
        expected: settings.images.checkmarkItemIcon.src,
        msg: 'created checkmark image for 1st exclamation selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.exclamation, mainInputSelection: 1 },
        expected: settings.images.exclamationItemIcon.src,
        msg: 'created exclaimation image for 2nd exclamation selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.exclamation, mainInputSelection: 2 },
        expected: settings.images.xItemIcon.src,
        msg: 'created X image for 3rd exclamation selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.abc, mainInputSelection: 0 },
        expected: settings.images.aItemIcon.src,
        msg: 'created A image for 1st ABC selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.abc, mainInputSelection: 1 },
        expected: settings.images.bItemIcon.src,
        msg: 'created B image for 2nd ABC selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.abc, mainInputSelection: 2 },
        expected: settings.images.cItemIcon.src,
        msg: 'created C image for 3rd ABC selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.oneToFive, mainInputSelection: 0 },
        expected: settings.images.oneItemIcon.src,
        msg: 'created #1 image for 1st 1-5 selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.oneToFive, mainInputSelection: 1 },
        expected: settings.images.twoItemIcon.src,
        msg: 'created #2 image for 2nd 1-5 selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.oneToFive, mainInputSelection: 2 },
        expected: settings.images.threeItemIcon.src,
        msg: 'created #3 image for 3rd 1-5 selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.oneToFive, mainInputSelection: 3 },
        expected: settings.images.fourItemIcon.src,
        msg: 'created #4 image for 4th 1-5 selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.oneToFive, mainInputSelection: 4 },
        expected: settings.images.fiveItemIcon.src,
        msg: 'created #5 image for 5th 1-5 selection',
      },
      {
        data: { mainInputType: MAIN_INPUTS.abc, isItemNA: true },
        expected: 'NA',
        msg: 'Added text "NA" to non-applicable item',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const item = mocking.createCompletedMainInputItem(
        MAIN_INPUTS.checkmark,
        false,
        data
      );
      const [result] = createReportPdf._proto.getContentItemBody(item);
      const actual = result.image || result.text;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('renders item signatures images from attachment data', () => {
    const expected = 'sig-data';
    const itemId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const item = mocking.createCompletedMainInputItem('signature', false, {
      itemType: 'signature',
    });
    item.id = itemId;
    inspection.template.items[itemId] = item;
    const instance = createReportPdf(inspection, property, {
      [itemId]: { signatureData: { datauri: expected } },
    });
    const [result] = instance.getContentItemBody(item);
    const actual = result.image;
    expect(actual).to.equal(expected);
  });

  it('creates inspector notes when item has them configured', () => {
    const expected = 'heading: Inspector Notes: | text: test notes';
    const item = mocking.createCompletedMainInputItem(
      MAIN_INPUTS.checkmark,
      false,
      { inspectorNotes: 'test notes' }
    );
    const [heading, body] = createReportPdf._proto.getContentItemBodyNotes(
      item
    );
    const actual = `heading: ${heading.text} | text: ${body.text}`;
    expect(actual).to.equal(expected);
  });

  it('creates admin edits when item has them configured', () => {
    const older = 1601067472;
    const newer = 1601067480;
    const formatTime = createReportPdf._proto._formatAdminEditDate;
    const olderFtm = formatTime(older);
    const newerFtm = formatTime(newer);
    const expected = `heading: Admin Edits: | text: ${olderFtm} a-1 e-1. | text: ${newerFtm} a-2 e-2.`;
    const item = mocking.createCompletedMainInputItem(
      MAIN_INPUTS.checkmark,
      false,
      {
        adminEdits: {
          newer: {
            edit_date: newer,
            admin_name: 'a-2',
            action: 'e-2',
          },
          older: {
            edit_date: older,
            admin_name: 'a-1',
            action: 'e-1',
          },
        },
      }
    );

    const [
      heading,
      ...bodies
    ] = createReportPdf._proto.getContentItemAdminUpdates(item);
    const actual = [
      `heading: ${heading.text}`,
      ...bodies.map(({ text }) => `text: ${text}`),
    ].join(' | ');
    expect(actual).to.equal(expected);
  });

  it('renders item attachment images from attachment data', () => {
    const expected = 'datauri-old | datauri-new';
    const older = 1601067472000;
    const newer = 1601067480000;
    const itemId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const item = mocking.createCompletedMainInputItem(
      MAIN_INPUTS.checkmark,
      false,
      {
        photosData: {
          [newer]: { downloadURL: 'ok' },
          [older]: { downloadURL: 'ok' },
        },
      }
    );
    item.id = itemId;
    inspection.template.items[itemId] = item;
    const instance = createReportPdf(inspection, property, {
      [itemId]: {
        photosData: {
          [newer]: {
            datauri: 'datauri-new',
          },
          [older]: {
            datauri: 'datauri-old',
          },
        },
      },
    });

    const result = instance.getContentItemPhotos(item);
    const actual = result[0].columns
      .reduce((flat, column) => {
        flat.push(column[0][0]);
        return flat;
      }, [])
      .map(({ image }) => image)
      .join(' | ');
    expect(actual).to.equal(expected);
  });

  it('does not add attachment images for signature items', () => {
    const expected = 'sig-data';
    const itemId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const attachmentId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const item = mocking.createCompletedMainInputItem('signature', false, {
      itemType: 'signature',
      photosData: {
        [attachmentId]: { downloadURL: 'not-expected' },
      },
    });
    item.id = itemId;
    inspection.template.items[itemId] = item;
    const instance = createReportPdf(inspection, property, {
      [itemId]: {
        signatureData: { datauri: expected },
        photosData: { [attachmentId]: 'not-expected' },
      },
    });
    const [result] = instance.getContentItemPhotos(item);
    const actual = Boolean(result);
    expect(actual).to.equal(false);
  });

  it('adds any caption after the attachment image', () => {
    const expected = 'test caption';
    const itemId = uuid();
    const photoId = '1601067480000';
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const item = mocking.createCompletedMainInputItem(
      MAIN_INPUTS.checkmark,
      false,
      {
        photosData: {
          [photoId]: {
            downloadURL: 'ok',
            caption: expected,
          },
        },
      }
    );
    item.id = itemId;
    inspection.template.items[itemId] = item;
    const instance = createReportPdf(inspection, property, {
      [itemId]: {
        photosData: {
          [photoId]: {
            datauri: 'datauri',
          },
        },
      },
    });
    const result = instance.getContentItemPhotos(item);
    const actual =
      (result[0] &&
        result[0].columns &&
        result[0].columns[0] &&
        result[0].columns[0][1] &&
        result[0].columns[0][1].text) ||
      '';
    expect(actual).to.equal(expected);
  });

  it("renders admin edit summary for each administrator's activities", () => {
    const expected = `Summary of Admin Activity
Testor Two made a total of 2 edits.
Testor One made a total of 1 edit.`;
    const propertyId = uuid();
    const inspectionId = uuid();
    const admin1Name = 'Testor One';
    const admin2Name = 'Testor Two';
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const items = [admin1Name, admin2Name, admin2Name].map(adminName =>
      mocking.createCompletedMainInputItem(MAIN_INPUTS.checkmark, false, {
        adminEdits: {
          [uuid()]: mocking.createInspItemAdminEdit({ admin_name: adminName }),
        },
      })
    );
    items.forEach(item => {
      inspection.template.items[uuid()] = item;
    });
    const instance = createReportPdf(inspection, property);
    const result = instance.adminActivitySummaryContent;
    const actual = result
      .map(r => r.text || '')
      .filter(Boolean)
      .join('\n');
    expect(actual).to.equal(expected);
  });

  it('does not render admin edit summary when none exist', () => {
    const expected = 0;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: propertyId });
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const item = mocking.createCompletedMainInputItem(
      MAIN_INPUTS.checkmark,
      false,
      {
        adminEdits: {},
      }
    );
    inspection.template.items[uuid()] = item;
    const instance = createReportPdf(inspection, property);
    const result = instance.adminActivitySummaryContent;
    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('contains separate section for deficient items when inspection has deficient items', async () => {
    const expected = 'DEFICIENT ITEMS';
    const propertyId = uuid();
    const itemId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
        sections: {
          [sectionId]: mocking.createSection(),
        },
      },
    });
    inspection.template.items[itemId].sectionId = sectionId;
    const inspectionId = uuid();
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const reportPdf = createReportPdf(
      inspection,
      property,
      inspection.template.items
    ).deficientItems;
    expect(reportPdf[0].text).to.be.equal(expected);
  });

  it('does not contain separate section for deficient items when inspection has no deficient items', async () => {
    const expected = true;
    const propertyId = uuid();
    const itemId = uuid();
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
        },
        sections: {
          [sectionId]: mocking.createSection(),
        },
      },
    });
    inspection.template.items[itemId].sectionId = sectionId;
    const inspectionId = uuid();
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const result = createReportPdf(
      inspection,
      property,
      inspection.template.items
    ).deficientItems;
    const actual = result.length === 0;
    expect(actual).to.equal(expected);
  });

  it('adds all deficient items to deficient items section', async () => {
    const expected = 2;
    const propertyId = uuid();
    const itemId = uuid();
    const secondItemId = uuid();
    const thirdItemId = uuid();
    const sectionId = uuid();
    const secondSectionId = uuid();
    const thirdSectionId = uuid();
    const inspection = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
          [secondItemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
          [thirdItemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
        },
        sections: {
          [sectionId]: mocking.createSection(),
          [secondSectionId]: mocking.createSection(),
          [thirdSectionId]: mocking.createSection(),
        },
      },
    });
    inspection.template.items[itemId].sectionId = sectionId;
    inspection.template.items[secondItemId].sectionId = secondSectionId;
    inspection.template.items[thirdItemId].sectionId = thirdSectionId;

    const inspectionId = uuid();
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const result = createReportPdf(
      inspection,
      property,
      inspection.template.items
    ).deficientItems;

    const actual = result.reduce((acc, entry) => {
      if (entry.style && entry.style === 'item') {
        acc += 1;
      } else if (
        entry.columns &&
        entry.columns[1] &&
        entry.columns[1].style === 'item'
      ) {
        acc += 1;
      }
      return acc;
    }, 0);

    expect(actual).to.equal(expected);
  });

  it('sorts all deficient items by section index and then item index', async () => {
    const expected = '1st,2nd,3rd';
    const propertyId = uuid();
    const itemId = uuid();
    const secondItemId = uuid();
    const thirdItemId = uuid();
    const sectionId = uuid();
    const secondSectionId = uuid();
    const inspection = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true,
            { index: 1, title: '3rd' }
          ),
          [secondItemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true,
            { index: 0, title: '2nd' }
          ),
          [thirdItemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true,
            { index: 0, title: '1st' }
          ),
        },
        sections: {
          [sectionId]: mocking.createSection({ index: 1, title: '2nd' }),
          [secondSectionId]: mocking.createSection({ index: 0, title: '1st' }),
        },
      },
    });
    inspection.template.items[itemId].sectionId = sectionId;
    inspection.template.items[secondItemId].sectionId = sectionId;
    inspection.template.items[thirdItemId].sectionId = secondSectionId;

    const inspectionId = uuid();
    const property = mocking.createProperty({ inspections: [inspectionId] });
    const result = createReportPdf(
      inspection,
      property,
      inspection.template.items
    ).deficientItems;

    const actual = result
      .reduce((acc, entry) => {
        if (entry.style && entry.style === 'item' && entry.text) {
          acc.push(entry.text);
        } else if (
          entry.columns &&
          entry.columns[1] &&
          entry.columns[1].style === 'item'
        ) {
          acc.push(entry.columns[1].text);
        }
        return acc;
      }, [])
      .join(',');
    expect(actual).to.equal(expected);
  });
});
