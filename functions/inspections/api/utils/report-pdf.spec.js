const { expect } = require('chai');
const moment = require('moment');
const createReportPdf = require('./report-pdf');
const uuid = require('../../../test-helpers/uuid');
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
});
