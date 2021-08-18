const { expect } = require('chai');
const validate = require('./validate-update');

describe('Properties | Utils | Validate Update', () => {
  it('rejects invalid update', () => {
    const data = [
      {
        property: { id: 1 },
        expected: 'id',
        msg: 'rejects non-string for id',
      },
      {
        property: { name: 1 },
        expected: 'name',
        msg: 'rejects non-string for name',
      },
      {
        property: { addr1: 1 },
        expected: 'addr1',
        msg: 'rejects non-string for addr1',
      },
      {
        property: { addr2: 1 },
        expected: 'addr2',
        msg: 'rejects non-string for addr2',
      },
      {
        property: { city: 1 },
        expected: 'city',
        msg: 'rejects non-string for city',
      },
      {
        property: { code: true },
        expected: 'code',
        msg: 'rejects non-string for code',
      },
      {
        property: { lastInspectionDate: 'no a num' },
        expected: 'lastInspectionDate',
        msg: 'rejects non-number for lastInspectionDate',
      },
      {
        property: { lastInspectionScore: 'no a num' },
        expected: 'lastInspectionScore',
        msg: 'rejects non-number for lastInspectionScore',
      },
      {
        property: { maint_super_name: 1 },
        expected: 'maint_super_name',
        msg: 'rejects non-string for maint_super_name',
      },
      {
        property: { manager_name: 1 },
        expected: 'manager_name',
        msg: 'rejects non-string for manager_name',
      },
      {
        property: { num_of_units: true },
        expected: 'num_of_units',
        msg: 'rejects non-number for num_of_units',
      },
      {
        property: { numOfInspections: true },
        expected: 'numOfInspections',
        msg: 'rejects non-number for numOfInspections',
      },
      {
        property: { bannerPhotoName: 1 },
        expected: 'bannerPhotoName',
        msg: 'rejects non-string for bannerPhotoName',
      },
      {
        property: { bannerPhotoURL: 1 },
        expected: 'bannerPhotoURL',
        msg: 'rejects non-string for bannerPhotoURL',
      },
      {
        property: { logoName: 1 },
        expected: 'logoName',
        msg: 'rejects non-string for logoName',
      },
      {
        property: { logoURL: 1 },
        expected: 'logoURL',
        msg: 'rejects non-string for logoURL',
      },
      {
        property: { photoName: 1 },
        expected: 'photoName',
        msg: 'rejects non-string for photoName',
      },
      {
        property: { photoURL: 1 },
        expected: 'photoURL',
        msg: 'rejects non-string for photoURL',
      },
      {
        property: { state: 1 },
        expected: 'state',
        msg: 'rejects non-string for state',
      },
      {
        property: { year_built: 'non num' },
        expected: 'year_built',
        msg: 'rejects non-number for year_built',
      },
      {
        property: { slackChannel: 1 },
        expected: 'slackChannel',
        msg: 'rejects non-string for slackChannel',
      },
      {
        property: { zip: 1 },
        expected: 'zip',
        msg: 'rejects non-string for zip',
      },
      {
        property: { templates: 1 },
        expected: 'templates',
        msg: 'rejects non-object for templates',
      },
      {
        property: { team: 1 },
        expected: 'team',
        msg: 'rejects non-string for team',
      },
      {
        property: { numOfDeficientItems: 'invalid' },
        expected: 'numOfDeficientItems',
        msg: 'rejects non-number for numOfDeficientItems',
      },
      {
        property: { numOfRequiredActionsForDeficientItems: 'invalid' },
        expected: 'numOfRequiredActionsForDeficientItems',
        msg: 'rejects non-number for numOfRequiredActionsForDeficientItems',
      },
      {
        property: { numOfFollowUpActionsForDeficientItems: 'invalid' },
        expected: 'numOfFollowUpActionsForDeficientItems',
        msg: 'rejects non-number for numOfFollowUpActionsForDeficientItems',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { property, expected, msg } = data[i];
      const result = validate({ ...property });
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('accepts a valid update', () => {
    const expected = [];
    const actual = validate({
      id: '1',
      name: 'test',
      addr1: 'test',
      addr2: 'test',
      city: 'test',
      code: 'test',
      lastInspectionDate: 123,
      lastInspectionScore: 123,
      loan_type: 'test',
      maint_super_name: 'test',
      manager_name: 'test',
      num_of_units: 123,
      numOfInspections: 123,
      bannerPhotoName: 'test',
      bannerPhotoURL: 'https://google.com/pic.jpg',
      logoName: 'test',
      logoURL: 'https://google.com/pic.jpg',
      photoName: 'test',
      photoURL: 'https://google.com/pic.jpg',
      state: 'test',
      year_built: 123,
      slackChannel: 'test',
      zip: 'test',
      templates: {
        'template-1': true,
      },
      team: 'team-1',
      numOfDeficientItems: 123,
      numOfRequiredActionsForDeficientItems: 123,
      numOfFollowUpActionsForDeficientItems: 123,
    });

    expect(actual).to.deep.equal(expected);
  });
});
