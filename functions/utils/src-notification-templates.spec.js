const { expect } = require('chai');
const compileTemplate = require('./src-notification-templates');

describe('Utils | Source Notifications Templates', () => {
  it('shoule compile all templates including all expected values', () => {
    const tests = [
      {
        template: 'deficient-item-state-change-summary',
        values: ['title', 'previousState', 'state', 'authorName'],
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
        template: 'deficient-item-update-summary',
        values: ['title', 'authorName'],
      },
      {
        template: 'deficient-item-update-markdown-body',
        values: [
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
          'authorName',
          'authorEmail',
        ],
      },
      {
        template: 'deficient-item-progress-note-summary',
        values: ['title', 'authorName', 'authorEmail'],
      },
      {
        template: 'deficient-item-progress-note-markdown-body',
        values: [
          'title',
          'section',
          'subSection',
          'dueDateDay',
          'currentResponsibilityGroup',
          'currentPlanToFix',
          'progressNote',
          'authorName',
          'authorEmail',
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
      {
        template: 'property-creation-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'property-creation-markdown-body',
        values: [
          'name',
          'addr1',
          'addr2',
          'city',
          'state',
          'zip',
          'teamName',
          'code',
          'slackChannel',
          'templateNames',
          'bannerPhotoURL',
          'photoURL',
          'authorName',
          'authorEmail',
        ],
      },
      {
        template: 'property-update-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'property-update-markdown-body',
        values: [
          'previousName',
          'previousAddr1',
          'previousAddr2',
          'previousCity',
          'previousState',
          'previousZip',
          'previousTeamName',
          'previousCode',
          'previousSlackChannel',
          'previousTemplateNames',
          'previousBannerPhotoURL',
          'previousPhotoURL',
          'currentName',
          'currentAddr1',
          'currentAddr2',
          'currentCity',
          'currentState',
          'currentZip',
          'currentTeamName',
          'currentCode',
          'currentSlackChannel',
          'currentTemplateNames',
          'currentBannerPhotoURL',
          'currentPhotoURL',
          'authorName',
          'authorEmail',
        ],
      },
      {
        template: 'template-delete-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'template-delete-markdown-body',
        values: ['name', 'authorName', 'authorEmail'],
      },
      {
        template: 'template-category-created-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'template-category-created-markdown-body',
        values: ['name', 'authorName', 'authorEmail'],
      },
      {
        template: 'template-category-delete-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'template-category-delete-markdown-body',
        values: ['name', 'authorName', 'authorEmail'],
      },
      {
        template: 'inspection-reassign-summary',
        values: ['currentDate', 'authorName'],
      },
      {
        template: 'inspection-reassign-markdown-body',
        values: [
          'startDate',
          'templateName',
          'propertyName',
          'authorName',
          'authorEmail',
        ],
      },
      {
        template: 'team-created-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'team-created-markdown-body',
        values: ['name', 'authorName', 'authorEmail'],
      },
      {
        template: 'team-update-summary',
        values: ['name', 'previousName', 'authorName'],
      },
      {
        template: 'team-update-markdown-body',
        values: ['name', 'previousName', 'authorName', 'authorEmail'],
      },
      {
        template: 'team-delete-summary',
        values: ['name', 'authorName'],
      },
      {
        template: 'team-delete-markdown-body',
        values: ['name', 'authorName', 'authorEmail'],
      },
      {
        template: 'inspection-completion-summary',
        values: ['completionDate', 'authorName', 'authorEmail', 'templateName'],
      },
      {
        template: 'inspection-completion-markdown-body',
        values: [
          'templateName',
          'startDate',
          'score',
          'deficientItemCount',
          'url',
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
        const data = {};

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
