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
      const [result] = createReportPdf._proto.getContentItemHeader(item);
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
});
