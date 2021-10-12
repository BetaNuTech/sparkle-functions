const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const timeMocking = require('../../../test-helpers/time');
const {
  createFirestore,
  createSnapshot,
  createCollection,
  createPubSubHandler,
} = require('../../../test-helpers/stubs');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const propertyModel = require('../../../models/properties');
const deficiencyModel = require('../../../models/deficient-items');
const notificationsModel = require('../../../models/notifications');
const createHandler = require('../../../deficient-items/pubsub/sync-overdue-v2');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

describe('Deficiencies | Pubsub | Sync Overdue V2', function() {
  beforeEach(() => sinon.stub(deficiencyModel, 'uuid').callsFake(uuid));
  afterEach(() => sinon.restore());

  it('should not set ineligible, past due, deficiencies to overdue', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const state = REQUIRED_ACTIONS_VALUES[0]; // not eligible to become overdue
    const deficiency = createDeficiency({
      state,
      property: propertyId,
      currentStartDate: timeMocking.age.twoDaysAgo,
      currentDueDate: timeMocking.age.oneDayAgo, // past due
    });
    const deficienciesCollection = createDeficienciesCollection(deficiency);

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();
    const update = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should not set eligible, non-due, deficiencies to overdue', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficiencies = OVERDUE_ELIGIBLE_STATES.map(state =>
      createDeficiency({
        state,
        property: propertyId,
        currentStartDate: timeMocking.age.twoDaysAgo,
        currentDueDate: timeMocking.age.oneDayFromNow, // not due
      })
    );
    const deficienciesCollection = createDeficienciesCollection(
      ...deficiencies
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();
    const update = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should set all eligible, past due, deficiencies to overdue', async () => {
    const expected = Array.of(...Array(OVERDUE_ELIGIBLE_STATES.length)).map(
      () => 'overdue'
    ); // update each eligible
    const propertyId = uuid();
    const property = mocking.createProperty();
    const startDate = timeMocking.age.sixDaysAgo;
    const deficiencies = [
      REQUIRED_ACTIONS_VALUES[0],
      ...OVERDUE_ELIGIBLE_STATES,
    ].map(state =>
      createDeficiency({
        state,
        property: propertyId,
        currentStartDate: startDate,
        currentDueDate: timeMocking.age.oneDayAgo, // past due
      })
    );
    const deficienciesCollection = createDeficienciesCollection(
      ...deficiencies
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();

    const actual = [];
    sinon
      .stub(deficiencyModel, 'updateRecord')
      .callsFake((_, id, { state: actualState }) => {
        actual.push(actualState);
        return Promise.resolve({});
      });

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('does not progress ineligible deficiency, over half past due, to "requires-progress-update" state', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficienciesCollection = createDeficienciesCollection(
      createDeficiency({
        state: 'pending',
        property: propertyId,
        currentStartDate: timeMocking.age.twoDaysAgo, // ineligible for requires progress state
        currentDueDate: timeMocking.age.oneDayFromNow, // over 1/2 past due
      })
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();
    const update = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('does not progress eligible deficiency, under half past due, to "requires-progress-update" state', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficienciesCollection = createDeficienciesCollection(
      createDeficiency({
        state: 'pending',
        property: propertyId,
        currentStartDate: timeMocking.age.fiveDaysAgo, // eligible for requires progress state
        currentDueDate: timeMocking.age.sixDaysFromNow, // under 1/2 past due
      })
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();
    const update = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('does not progress deficiency to "requires-progress-update" when it does not require progress notes', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficienciesCollection = createDeficienciesCollection(
      createDeficiency({
        state: 'pending',
        property: propertyId,
        currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
        currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
        willRequireProgressNote: false, // Progress notes not needed
      })
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();
    const update = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('progresses eligible deficiency, under half past due, to "requires-progress-update" state', async () => {
    const expected = 'requires-progress-update';
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficienciesCollection = createDeficienciesCollection(
      createDeficiency({
        state: 'pending',
        property: propertyId,
        currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
        currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
        willRequireProgressNote: true,
      })
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(notificationsModel, 'createRecord').resolves();

    let actual = '';
    sinon
      .stub(deficiencyModel, 'updateRecord')
      .callsFake((_, id, { state: actualState }) => {
        actual = actualState;
        return Promise.resolve({});
      });

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("creates a notification when a deficiency's state is updated", async () => {
    const expected = true;
    const propertyId = uuid();
    const property = mocking.createProperty();
    const deficienciesCollection = createDeficienciesCollection(
      createDeficiency({
        state: 'pending',
        property: propertyId,
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
        trelloCardURL: 'trelloCardURL',
        progressNotes: {
          createdAt: mocking.nowUnix(),
          progressNote: 'progressNote',
        },
        willRequireProgressNote: true,
      })
    );

    // Stub requests
    sinon.stub(deficiencyModel, 'query').resolves(deficienciesCollection);
    sinon.stub(propertyModel, 'updateMetaData').resolves();
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    const update = sinon.stub(notificationsModel, 'createRecord').resolves();

    // Execute
    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    // Test Results
    const actual = update.called;

    // Assertions
    expect(actual).to.equal(expected);
  });
});

/**
 * Hide boilerplate of constructing
 * a deficiency tracking inspection
 * containing an deficient item
 * @param  {Object} defConfig
 * @return {Object}
 */
function createDeficiency(defConfig = {}) {
  const finalConfig = JSON.parse(JSON.stringify(defConfig));
  if (!finalConfig.inspection) finalConfig.inspection = uuid();
  if (!finalConfig.item) finalConfig.item = uuid();
  const inspection = mocking.createInspection({
    deficienciesExist: true,
    inspectionCompleted: true,
    property: finalConfig.property,
    template: {
      trackDeficientItems: true,
      items: {
        // Create single deficient item on inspection
        [finalConfig.item]: mocking.createCompletedMainInputItem(
          'twoactions_checkmarkx',
          true
        ),
      },
    },
  });

  return mocking.createDeficiency(
    finalConfig,
    inspection,
    inspection.template.items[finalConfig.item]
  );
}

/**
 * Create a collection of deficiency snapshots
 * @param  {Object[]} deficiencies
 * @return {Object} - Firestore collection mock
 */
function createDeficienciesCollection(...deficiencies) {
  return createCollection(
    ...deficiencies.map(deficiency => createSnapshot(uuid(), deficiency))
  );
}
