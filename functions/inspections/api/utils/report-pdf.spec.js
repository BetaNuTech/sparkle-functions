const { expect } = require('chai');
const moment = require('moment');
const createReportPdf = require('./report-pdf');
const uuid = require('../../../test-helpers/uuid');
const settings = require('../../../config/report-pdf-settings');
const mocking = require('../../../test-helpers/mocking');

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
            'twoactions_checkmarkx',
            false,
            data
          );
      const [result] = createReportPdf._proto.getContentItemHeader(item);
      const actual = `text: ${result.text} | style: ${result.style}`;
      expect(actual).to.equal(expected, msg);
    }
  });
});
