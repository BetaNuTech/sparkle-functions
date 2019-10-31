const { expect } = require('chai');
const compileTemplate = require('./src-notification-templates');

describe('Utils | Source Notifications Templates', () => {
  it('shoule compile all templates including all expected values', () => {
    const tests = [
      {
        template: 'deficient-item-state-change-summary',
        values: ['title', 'previousState', 'state'],
      },
      {
        template: 'deficient-item-state-change-markdown-body',
        values: [
          'previousState',
          'state',
          'title',
          'section',
          'subSection',
          'currentDueDateDay',
          'currentDeferredDateDay',
          'currentPlanToFix',
          'currentResponsibilityGroup',
          'currentProgressNote',
          {
            currentProgressNote: 'currentProgressNote',
            progressNoteDateDay: 'progressNoteDateDay',
          },
          'currentCompleteNowReason',
          'currentReasonIncomplete',
          'url',
          'trelloUrl',
        ],
      },
      {
        template: 'inspection-pdf-creation-summary',
        values: ['createdAt', 'authorName', 'authorEmail'],
      },
      {
        template: 'inspection-pdf-creation-markdown-body',
        values: [
          'templateName',
          'startDate',
          'completeDate',
          'inspectionUrl',
          'reportUrl',
          'authorName',
          'authorEmail',
        ],
      },
      {
        template: 'inspection-pdf-update-summary',
        values: ['updatedAt', 'authorName', 'authorEmail'],
      },
      {
        template: 'inspection-pdf-update-markdown-body',
        values: [
          'templateName',
          'startDate',
          'completeDate',
          'inspectionUrl',
          'reportUrl',
          'authorName',
          'authorEmail',
        ],
      },
    ];

    // Sanity check
    let actualAssertions = 0;
    const expectedAssertions = tests.reduce(
      (acc, { values }) => acc + values.length,
      0
    );

    for (let i = 0; i < tests.length; i++) {
      const { template, values } = tests[i];

      for (let k = 0; k < values.length; k++) {
        const value = values[k];
        const data = Object.create(null);

        if (typeof value === 'object') {
          Object.assign(data, value);
        } else {
          data[value] = value;
        }

        const result = compileTemplate(template, data);
        if (typeof value === 'object') {
          Object.keys(value).forEach(attr => {
            const val = value[attr];
            expect(result).to.include(
              val,
              `template: "${template}" compiled with value: "${val}"`
            );
          });
        } else {
          expect(result).to.include(
            value,
            `template: "${template}" compiled with value: "${value}"`
          );
        }
        actualAssertions++;
      }
    }

    expect(actualAssertions).to.equal(expectedAssertions);
  });
});
