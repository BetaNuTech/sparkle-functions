const { expect } = require('chai');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const timeMocking = require('../../../test-helpers/time');
const propertyModel = require('../../../models/properties');
const inspectionModel = require('../../../models/inspections');
const deficiencyModel = require('../../../models/deficient-items');
const notificationsModel = require('../../../models/notifications');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, test, cloudFunctions } = require('../../setup');

const DEF_ITEM_URI = config.clientApps.web.deficientItemURL;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

describe('Deficiency |  Pubsub | Overdue Sync V2', () => {
  afterEach(() => cleanDb(null, fs));

  it('should set all eligible, past due, deficiencies to overdue', async () => {
    const propertyId = uuid();
    const startDate = timeMocking.age.sixDaysAgo;
    const lastUpdate = timeMocking.age.twoDaysAgo;
    const inspections = [];
    const deficiencies = [];
    OVERDUE_ELIGIBLE_STATES.forEach(eligibleState => {
      const inspectionId = uuid();
      const itemId = uuid();
      const inspection = mocking.createInspection({
        id: inspectionId,
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
        },
      });
      inspections.push(inspection);
      deficiencies.push(
        mocking.createDeficiency(
          {
            state: eligibleState,
            updatedAt: lastUpdate,
            property: propertyId,
            inspection: inspectionId,
            item: itemId,
            currentStartDate: startDate,
            currentDueDate: timeMocking.age.oneDayAgo, // past due
          },
          inspection,
          inspection.template.items[itemId]
        )
      );
    });
    const property = mocking.createProperty({
      numOfRequiredActionsForDeficientItems: 0,
    });

    // Setup Database
    for (let i = 0; i < deficiencies.length; i++) {
      const deficiency = deficiencies[i];
      await deficiencyModel.createRecord(fs, uuid(), deficiency);
    }
    for (let i = 0; i < inspections.length; i++) {
      const inspection = inspections[i];
      const inspectionId = inspection.id;
      delete inspection.id;
      await inspectionModel.createRecord(fs, inspectionId, inspection);
    }
    await propertyModel.createRecord(fs, propertyId, property);

    // Execute
    await test.wrap(cloudFunctions.deficiencySyncOverdue)();

    // Test result
    const propertySnap = await propertyModel.findRecord(fs, propertyId);
    const deficienciesSnap = await deficiencyModel.query(fs, {
      property: ['==', propertyId],
    });
    const propertyData = propertySnap.data() || {};
    const requiredActions =
      propertyData.numOfRequiredActionsForDeficientItems || 0;
    const overdueCounter = propertyData.numOfOverdueDeficientItems || 0;
    const deficiencyStates = deficienciesSnap.docs.map(
      doc => (doc.data() || {}).state || ''
    );
    const deficiencyUpdatedAts = deficienciesSnap.docs.map(
      doc => (doc.data() || {}).updatedAt || 0
    );
    const defLastStateHistEntry = deficienciesSnap.docs.map(doc => {
      const stateHistory = (doc.data() || {}).stateHistory || {};
      return (stateHistory[Object.keys(stateHistory)[0]] || {}).state || '';
    });

    // Assertions
    [
      {
        actual: requiredActions,
        expected: OVERDUE_ELIGIBLE_STATES.length,
        msg:
          'updates property meta data to count all required action deficiencies',
      },
      {
        actual: overdueCounter,
        expected: OVERDUE_ELIGIBLE_STATES.length,
        msg:
          'updates property meta data with the latest overdue deficiency count',
      },
      {
        actual: deficiencyStates.join(','),
        expected: Array.of(...Array(OVERDUE_ELIGIBLE_STATES.length))
          .map(() => 'overdue')
          .join(','),
        msg: 'all deficencies became overdue',
      },
      {
        actual: deficiencyUpdatedAts.every(updatedAt => updatedAt > lastUpdate),
        expected: true,
        msg: 'updated every deficiencies last updated at timestamp',
      },
      {
        actual: defLastStateHistEntry.join(','),
        expected: Array.of(...Array(OVERDUE_ELIGIBLE_STATES.length))
          .map(() => 'overdue')
          .join(','),
        msg: 'all deficencies have overdue last state history entry',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('sets eligible deficiency, under half past due, to "requires-progress-update" state', async () => {
    const expected = 'requires-progress-update';
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const property = mocking.createProperty();
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
      },
    });
    const deficiency = mocking.createDeficiency(
      {
        state: 'pending',
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
        currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
        willRequireProgressNote: true,
      },
      inspection,
      inspection.template.items[itemId]
    );

    // Setup database
    await deficiencyModel.createRecord(fs, deficiencyId, deficiency);
    await inspectionModel.createRecord(fs, inspectionId, inspection);
    await propertyModel.createRecord(fs, propertyId, property);

    // Execute
    await test.wrap(cloudFunctions.deficiencySyncOverdue)();

    // Test Result
    const deficiencySnap = await deficiencyModel.findRecord(fs, deficiencyId);
    const actual = (deficiencySnap.data() || {}).state;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("creates a notification when a deficiency's state is updated", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const property = mocking.createProperty();
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
      },
    });
    const deficiency = mocking.createDeficiency(
      {
        state: 'pending',
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
        currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
        itemTitle: 'title',
        sectionTitle: 'sectionTitle',
        sectionSubtitle: 'sectionSubtitle',
        currentDueDateDay: '10/23/40',
        currentPlanToFix: 'currentPlanToFix',
        urrentResponsibilityGroup: 'site_level_manages_vendor',
        currentCompleteNowReason: 'currentCompleteNowReason',
        currentReasonIncomplete: 'currentReasonIncomplete',
        trelloCardURL: 'test.com/card',
        progressNotes: {
          createdAt: Math.round(Date.now() / 1000),
          progressNote: 'progressNote',
        },
        willRequireProgressNote: true,
      },
      inspection,
      inspection.template.items[itemId]
    );
    const defUrl = DEF_ITEM_URI.replace('{{propertyId}}', propertyId).replace(
      '{{deficientItemId}}',
      deficiencyId
    );

    const expected = {
      title: property.name,
      summary:
        'Deficient Item: title moved from pending to requires-progress-update by Sparkle',
      property: propertyId,
      markdownBody: `Deficient Item moved from *pending* to state *requires-progress-update*.\n\`\`\`\nTitle: title\nSection: sectionTitle\nSub-section: sectionSubtitle\nDue Date: 10/23/40\nPlan to fix: currentPlanToFix\n\`\`\`\n\`\`\`\nComplete Now Reason: currentCompleteNowReason\n\`\`\`\n\`\`\`\nReason Incomplete: currentReasonIncomplete\n\`\`\`\nDeficient Item: ${defUrl}\nTrello Card: test.com/card\n*Updated by*: Sparkle`,
      creator: '',
    };

    // Setup database
    await deficiencyModel.createRecord(fs, deficiencyId, deficiency);
    await inspectionModel.createRecord(fs, inspectionId, inspection);
    await propertyModel.createRecord(fs, propertyId, property);

    // Execute
    await test.wrap(cloudFunctions.deficiencySyncOverdue)();

    // Test Result
    const resultsSnap = await notificationsModel.query(fs, {
      property: ['==', propertyId],
    });
    const actual = resultsSnap.docs[0] ? resultsSnap.docs[0].data() || {} : {};

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
