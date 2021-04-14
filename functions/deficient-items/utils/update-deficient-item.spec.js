const assert = require('assert');
const { expect } = require('chai');
const mocking = require('../../test-helpers/mocking');
const updateDeficientItem = require('./update-deficient-item');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

const PROGRESS_NOTES = ['looks better', 'okay', 'back to square one', 'woah'];
const DOWNLOAD_URL = [
  'https://firebasestorage.googleapis.com/v0/b/sapphire-inspections.appspot.com/o/deficientItemImagesStaging%2F-KYLYDoEoEwbxJ5AjWaX%2F-Lchlj4YikI6eqsNt4SN%2F-LecC3gBBXWfCE6RaTYi.jpg?alt=media&token=4620580c-f6dc-445d-8f65-b684f813f22f',
  'https://firebasestorage.googleapis.com/v0/b/sapphire-inspections.appspot.com/o/deficientItemImagesStaging%2F-KYLYDoEoEwbxJ5AjWaX%2F-LcY0VWdyHk-0-ZXaPYL%2F-LeIhwmEVX3K3G8IIapY.jpg?alt=media&token=c7d56117-fce6-47ca-99f7-a775f8227439',
  'https://firebasestorage.googleapis.com/v0/b/sapphire-inspections.appspot.com/o/deficientItemImagesStaging%2F-KYLYDoEoEwbxJ5AjWaX%2F-LcY0VWdyHk-0-ZXaPYL%2F-Lec5UCvoLdQ3Ig3VLhh.jpg?alt=media&token=833dca41-9995-48b9-bd45-dc7c52557f2f',
];
const STORAGE_PATH = [
  'deficientItemImagesStaging/-KYLYDoEoEwbxJ5AjWaX/-Lchlj4YikI6eqsNt4SN/-LecC3gBBXWfCE6RaTYi.jpg',
  'deficientItemImagesStaging/-KYLYDoEoEwbxJ5AjWaX/-LcY0VWdyHk-0-ZXaPYL/-LeIhwmEVX3K3G8IIapY.jpg',
  'deficientItemImagesStaging/-KYLYDoEoEwbxJ5AjWaX/-LcY0VWdyHk-0-ZXaPYL/-Lec5UCvoLdQ3Ig3VLhh.jpg',
];

describe('Deficiency | Utils | Update Deficient Item', () => {
  it('sets go back state only when specific states are active', function() {
    [
      { data: 'completed', expected: true },
      { data: 'incomplete', expected: true },
      { data: 'overdue', expected: false },
      { data: 'requires-action', expected: false },
      { data: 'go-back', expected: false },
      { data: 'requires-progress-update', expected: false },
      { data: 'closed', expected: false },
      { data: 'deferred', expected: true },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: data });
      const changes = { state: 'go-back' };
      const updates = updateDeficientItem(model, changes);
      const actual = updates.state === 'go-back';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${expected ? '' : 'not '}equal go-back`
      );
    });
  });

  // TODO: remove
  it('removes "current" DI attributes when set as go-back', function() {
    const model = createDeficientItem({
      state: 'deferred',
      currentPlanToFix: 'test',
      currentReasonIncomplete: 'test',
      currentDueDateDay: '1/2/20',
      currentResponsibilityGroup: 'in house',
      currentStartDate: nowUnix(),
      currentDeferredDate: nowUnix(),
      currentDeferredDateDay: '1/2/20',
    });
    const changes = { state: 'go-back' };
    const updates = updateDeficientItem(model, changes);

    [
      'currentPlanToFix',
      'currentReasonIncomplete',
      'currentDueDate',
      'currentDueDateDay',
      'currentDeferredDate',
      'currentDeferredDateDay',
      'currentResponsibilityGroup',
      'currentStartDate',
    ].forEach(attr => {
      const actual = updates[attr];
      expect(actual).to.equal(null, `removed attribute ${attr}`);
    });
  });

  it('sets a current due date day from current due date', function() {
    const updates = [
      1546300800000,
      1557446400000,
      1554854400000,
      1557360000000,
      1589328000000,
      1577750400000,
    ];

    [
      {
        update: updates[0],
        expected: toLocalDate(new Date(updates[0] * 1000)),
      },
      {
        update: updates[1],
        expected: toLocalDate(new Date(updates[1] * 1000)),
      },
      {
        update: updates[2],
        expected: toLocalDate(new Date(updates[2] * 1000)),
      },
      {
        update: updates[3],
        expected: toLocalDate(new Date(updates[3] * 1000)),
      },
      {
        update: updates[4],
        expected: toLocalDate(new Date(updates[4] * 1000)),
      },
      {
        update: updates[5],
        expected: toLocalDate(new Date(updates[5] * 1000)),
      },
    ].forEach(({ update, expected }) => {
      const model = createDeficientItem({});
      const changes = { currentDueDate: update };
      const result = updateDeficientItem(model, changes);
      const actual = result.currentDueDateDay;
      expect(actual).to.equal(expected);
    });
  });

  it('sets pending state only when specific states are active', function() {
    const createdAt = nowUnix() - 1;
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const progressNotes = {
      [uuid()]: {
        createdAt: nowUnix(),
        progressNote: 'note',
        startDate: tomorrow,
      },
    };

    [
      { data: 'completed', expected: false },
      { data: 'incomplete', expected: false },
      { data: 'overdue', expected: false },
      { data: 'requires-action', expected: true },
      { data: 'go-back', expected: true },
      { data: 'requires-progress-update', progressNotes, expected: true },
      { data: 'closed', expected: false },
    ].forEach(({ data, progressNotes: progressNotesArg, expected }) => {
      const model = createDeficientItem({
        state: data,
        currentDueDate: tomorrow,
        progressNotes: progressNotesArg,
        currentResponsibilityGroup: 'corporate_manages_vendor',
        currentPlanToFix: 'fix',
      });
      const changes = { state: 'pending' };
      const updates = updateDeficientItem(
        model,
        changes,
        '',
        createdAt,
        'note'
      );
      const actual = updates.state === 'pending';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${expected ? '' : 'not '}equal pending`
      );
    });
  });

  it('sets completed state only when specific states are active', function() {
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const completedPhotos = createCompletedPhotosTree(tomorrow, 1, '1');
    [
      { data: 'completed', expected: false },
      { data: 'incomplete', expected: false },
      { data: 'overdue', expected: false },
      { data: 'requires-action', expected: false },
      { data: 'go-back', expected: false },
      { data: 'pending', expected: false },
      { data: 'pending', completedPhotos, expected: true },
      { data: 'requires-progress-update', expected: false },
      { data: 'closed', expected: false },
      { data: 'deferred', expected: false },
    ].forEach(({ data, completedPhotos: completedPhotosArg, expected }) => {
      const model = createDeficientItem({
        state: data,
        currentStartDate: tomorrow,
        completedPhotos: completedPhotosArg,
      });
      const changes = { state: 'completed' };
      const updates = updateDeficientItem(model, changes);
      const actual = updates.state === 'completed';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${
          expected ? '' : 'not '
        }equal completed ${
          completedPhotosArg ? 'with' : 'without'
        } completed photo`
      );
    });
  });

  it('sets closed state only when specific states are active', function() {
    [
      { data: 'completed', expected: true },
      { data: 'incomplete', expected: true },
      { data: 'overdue', expected: false },
      { data: 'requires-action', expected: true },
      { data: 'go-back', expected: false },
      { data: 'requires-progress-update', expected: false },
      { data: 'closed', expected: false },
      { data: 'deferred', expected: true },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: data });
      const changes = { state: 'closed' };
      const updates = updateDeficientItem(model, changes);
      const actual = updates.state === 'closed';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${expected ? '' : 'not '}equal closed`
      );
    });
  });

  it('sets requires progress update state only when specific state(s) are active', function() {
    [
      { data: 'completed', expected: false },
      { data: 'incomplete', expected: false },
      { data: 'overdue', expected: false },
      { data: 'pending', expected: true },
      { data: 'requires-action', expected: false },
      { data: 'go-back', expected: false },
      { data: 'requires-progress-update', expected: false },
      { data: 'closed', expected: false },
      { data: 'deferred', expected: false },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: data });
      const changes = { state: 'requires-progress-update' };
      const updates = updateDeficientItem(model, changes);
      const actual = updates.state === 'requires-progress-update';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${
          expected ? '' : 'not '
        }equal requires-progress-update`
      );
    });
  });

  // TODO:
  // it('only transitions to requires progress update when more than 1/2 way to due date', function() {});

  it('appends a state history entry when pending state is set', function() {
    const user = uuid();
    const createdAt = nowUnix();
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const expected = { state: 'pending', user, createdAt };
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      state: 'pending',
      currentDueDate: tomorrow,
      currentResponsibilityGroup: 'corporate_manages_vendor',
      currentPlanToFix: 'fix',
    };
    delete model.stateHistory; // sanity check
    const updates = updateDeficientItem(
      model,
      changes,
      user,
      createdAt,
      'note'
    );
    const [stateHistoryKey] = Object.keys(updates.stateHistory);
    const actual = updates.stateHistory[stateHistoryKey];
    expect(actual).to.deep.equal(expected);
  });

  it('sets current start date when updated to pending', function() {
    const createdAt = nowUnix();
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      state: 'pending',
      currentDueDate: tomorrow,
      currentResponsibilityGroup: 'corporate_manages_vendor',
      currentPlanToFix: 'fix',
    };
    const updates = updateDeficientItem(model, changes, '', createdAt, 'note');
    const actual = updates.state;
    expect(actual).to.equal('pending', 'updated state to pending');
    expect(Boolean(updates.currentStartDate)).to.equal(
      true,
      'updated with current start date'
    );
  });

  it('uses updated current start date setting history hash start dates', function() {
    const createdAt = nowUnix();
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      state: 'pending',
      currentDueDate: tomorrow,
      currentResponsibilityGroup: 'corporate_manages_vendor',
      currentPlanToFix: 'fix',
    };
    const updates = updateDeficientItem(model, changes, '', createdAt, 'note');
    assert.ok(updates.currentStartDate, 'has updated current start date');
    assert.ok(updates.startDates, 'has updated start dates history hash');
    const acutal =
      updates.startDates[Object.keys(updates.startDates)[0]].startDate;
    const expected = updates.currentStartDate;
    expect(acutal).to.equal(
      expected,
      'used updated current start date in `startDates`'
    );
  });

  it('allows updating current due date with a valid timestamp', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = Math.round(Date.now() / 1000);
    const changes = { currentDueDate: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.currentDueDate;
    expect(actual).to.equal(expected);
  });

  it('allows updating current plan to fix with a valid string', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = 'current plan';
    const changes = { currentResponsibilityGroup: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.currentResponsibilityGroup;
    expect(actual).to.equal(expected);
  });

  it('allows updating current responsibility group with a valid string', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = 'corporate_manages_vendor';
    const changes = { currentPlanToFix: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.currentPlanToFix;
    expect(actual).to.equal(expected);
  });

  it('sets pending state only when update meets requirements', function() {
    const createdAt = nowUnix();
    const tomorrow = nowUnix() + 24 * 60 * 60;
    [
      { data: [], expected: false },
      { data: ['currentDueDate'], expected: false },
      {
        data: ['currentDueDate', 'currentResponsibilityGroup'],
        expected: false,
      },
      { data: ['currentDueDate', 'currentPlanToFix'], expected: false },
      {
        data: ['currentResponsibilityGroup', 'currentPlanToFix'],
        expected: false,
      },
      {
        data: [
          'currentDueDate',
          'currentResponsibilityGroup',
          'currentPlanToFix',
        ],
        expected: true,
      },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: 'requires-action' });
      const changes = { state: 'pending' };
      if (data.includes('currentDueDate')) {
        changes.currentDueDate = tomorrow;
      }
      if (data.includes('currentResponsibilityGroup')) {
        changes.currentResponsibilityGroup = 'corporate_manages_vendor';
      }
      if (data.includes('currentPlanToFix')) {
        changes.currentPlanToFix = 'fix';
      }
      const updates = updateDeficientItem(
        model,
        changes,
        '',
        createdAt,
        'note'
      );
      const actual = updates.state === 'pending';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${expected ? '' : 'not '}equal pending`
      );
    });
  });

  it('sets pending state when progress note is required', function() {
    const pendingReadyDI = {
      currentResponsibilityGroup: 'corporate_manages_vendor',
      currentPlanToFix: 'fix',
    };
    let fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    fourDaysFromNow = toUnix(fourDaysFromNow);
    let sixDaysFromNow = new Date();
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
    sixDaysFromNow = toUnix(sixDaysFromNow);
    const createdAt = nowUnix();

    [
      {
        data: Object.assign(
          {
            state: 'deferred',
            currentDueDate: sixDaysFromNow,
          },
          pendingReadyDI
        ),
        expected: undefined,
        msg: 'does not update progress note requirement for unrelated states',
      },
      {
        data: Object.assign(
          {
            state: 'requires-progress-update',
            currentDueDate: sixDaysFromNow,
          },
          pendingReadyDI
        ),
        progressNote: 'note',
        expected: false,
        msg: 'adding progress note removes progress note requirement',
      },
      {
        data: Object.assign(
          {
            state: 'requires-action',
            currentDueDate: fourDaysFromNow,
          },
          pendingReadyDI
        ),
        expected: false,
        msg:
          'requires-action to pending with due date < 5 days removes progress note requirement',
      },
      {
        data: Object.assign(
          {
            state: 'go-back',
            currentDueDate: fourDaysFromNow,
          },
          pendingReadyDI
        ),
        expected: false,
        msg:
          'go-back to pending with due date < 5 days removes progress note requirement',
      },
      {
        data: Object.assign(
          {
            state: 'requires-action',
            currentDueDate: sixDaysFromNow,
          },
          pendingReadyDI
        ),
        expected: true,
        msg:
          'requires-action to pending with due date >= 5 days requires progress note',
      },
      {
        data: Object.assign(
          {
            state: 'go-back',
            currentDueDate: sixDaysFromNow,
          },
          pendingReadyDI
        ),
        expected: true,
        msg:
          'go-back to pending with due date >= 5 days requires progress note',
      },
    ].forEach(({ data, expected, msg, progressNote = '' }) => {
      const model = createDeficientItem(data);
      const changes = { state: 'pending' };
      const updates = updateDeficientItem(
        model,
        changes,
        '',
        createdAt,
        progressNote
      );
      const actual = updates.willRequireProgressNote;
      expect(actual).to.equal(expected, msg);
    });
  });

  it('sets incomplete state only when specific state(s) are active', function() {
    const createdAt = nowUnix();
    [
      { data: 'completed', expected: false },
      { data: 'incomplete', expected: false },
      { data: 'overdue', expected: true },
      { data: 'requires-action', expected: false },
      { data: 'go-back', expected: false },
      { data: 'requires-progress-update', expected: false },
      { data: 'closed', expected: false },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: data });
      const changes = {
        state: 'incomplete',
        currentReasonIncomplete: 'woopsy',
      };
      const updates = updateDeficientItem(
        model,
        changes,
        '',
        createdAt,
        'note'
      );
      const actual = updates.state === 'incomplete';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${
          expected ? '' : 'not '
        }equal incomplete`
      );
    });
  });

  it('sets incomplete state on overdue only when model requirements met', function() {
    const createdAt = nowUnix();
    [
      { data: [], expected: false },
      { data: ['currentReasonIncomplete'], expected: true },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: 'overdue' });
      const changes = { state: 'incomplete' };
      if (data.includes('currentReasonIncomplete')) {
        changes.currentReasonIncomplete = 'woopsy';
      }
      const updates = updateDeficientItem(
        model,
        changes,
        '',
        createdAt,
        'note'
      );
      const actual = updates.state === 'incomplete';
      expect(actual).to.equal(
        expected,
        `state: ${data} was expected to ${
          expected ? '' : 'not '
        }equal incomplete`
      );
    });
  });

  it('appends a state history entry when incomplete state is set', function() {
    const user = uuid();
    const createdAt = nowUnix() - 1;
    const expected = { state: 'incomplete', user, createdAt };
    const model = createDeficientItem({ state: 'overdue' });
    const changes = { state: 'incomplete', currentReasonIncomplete: 'woopsy' };
    delete model.stateHistory; // sanity check
    const updates = updateDeficientItem(
      model,
      changes,
      user,
      createdAt,
      'note'
    );
    const [stateHistoryKey] = Object.keys(updates.stateHistory);
    const actual = updates.stateHistory[stateHistoryKey];
    expect(actual).to.deep.equal(expected);
  });

  it('appends a new item to state history when state changes', function() {
    const userID = '-123';
    const createdAt = nowUnix();
    const tests = [
      {
        expected: {},
        update: 'requires-action',
        data: { state: 'requires-action' },
        args: [],
        message: 'ignored same state change',
      },
      {
        expected: { state: 'go-back', createdAt },
        update: 'go-back',
        data: { state: 'deferred' },
        args: ['', createdAt],
        message: 'recorded state change',
      },
      {
        expected: {
          state: 'go-back',
          createdAt,
          user: userID,
        },
        update: 'go-back',
        data: { state: 'deferred' },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = { state: update };
      const { stateHistory } = updateDeficientItem(model, changes, ...args);
      const actual = stateHistory
        ? stateHistory[Object.keys(stateHistory)[0]]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a new item to due dates when current due date changes', function() {
    const userID = '-123';
    const createdAt = nowUnix() - 1;
    const updates = Array.from(
      { length: 5 },
      (_, i) => (Date.now() + i) / 1000
    );
    const currentStartDate = nowUnix();
    const tests = [
      {
        expected: {},
        update: {
          currentDueDate: updates[0],
          currentDueDateDay: toDate(updates[0]),
        },
        data: {
          currentDueDate: updates[0],
          currentDueDateDay: toDate(updates[0]),
        },
        args: [],
        message: 'ignored same due date change',
      },
      {
        expected: {
          createdAt,
          dueDate: updates[1],
          dueDateDay: toDate(updates[1]),
          startDate: currentStartDate,
        },
        update: {
          currentDueDate: updates[1],
          currentDueDateDay: toDate(updates[1]),
        },
        data: {
          currentStartDate,
          currentDueDate: updates[0],
          currentDueDateDay: toDate(updates[0]),
        },
        args: ['', createdAt],
        message: 'recorded due date change',
      },
      {
        expected: {
          createdAt,
          dueDate: updates[1],
          dueDateDay: toDate(updates[1]),
          startDate: currentStartDate,
          user: userID,
        },
        update: {
          currentDueDate: updates[1],
          currentDueDateDay: toDate(updates[1]),
        },
        data: {
          currentStartDate,
          currentDueDate: updates[0],
          currentDueDateDay: toDate(updates[0]),
        },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = {
        currentDueDate: update.currentDueDate,
        currentDueDateDay: update.currentDueDateDay,
      };
      const { dueDates } = updateDeficientItem(model, changes, ...args);
      const actual = dueDates ? dueDates[Object.keys(dueDates)[0]] : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a new item to plans to fix when current plan changes', function() {
    const userID = '-123';
    const createdAt = nowUnix();
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = nowUnix();
    const tests = [
      {
        expected: {},
        update: updates[0],
        data: { currentPlanToFix: updates[0] },
        args: [],
        message: 'ignored same plan change',
      },
      {
        expected: {
          planToFix: updates[1],
          startDate: currentStartDate,
          createdAt,
        },
        update: updates[1],
        data: { currentPlanToFix: updates[0], currentStartDate },
        args: ['', createdAt],
        message: 'recorded plan change',
      },
      {
        expected: {
          planToFix: updates[1],
          startDate: currentStartDate,
          createdAt,
          user: userID,
        },
        update: updates[1],
        data: { currentPlanToFix: updates[0], currentStartDate },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = { currentPlanToFix: update };
      const { plansToFix } = updateDeficientItem(model, changes, ...args);
      const actual = plansToFix ? plansToFix[Object.keys(plansToFix)[0]] : {};
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('appends a new item to complete now reasons when current plan changes', function() {
    const userID = '-123';
    const createdAt = nowUnix() - 1;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const tests = [
      {
        expected: {},
        update: updates[0],
        data: { currentCompleteNowReason: updates[0] },
        args: [],
        message: 'ignored equivalent change',
      },
      {
        expected: {
          completeNowReason: updates[1],
          createdAt,
        },
        update: updates[1],
        data: { currentCompleteNowReason: updates[0] },
        args: ['', createdAt],
        message: 'recorded plan change',
      },
      {
        expected: {
          completeNowReason: updates[1],
          createdAt,
          user: userID,
        },
        update: updates[1],
        data: { currentCompleteNowReason: updates[0] },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = { currentCompleteNowReason: update };
      const { completeNowReasons } = updateDeficientItem(
        model,
        changes,
        ...args
      );
      const actual = completeNowReasons
        ? Object.values(completeNowReasons)[0]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a new responsiblity group when current group changes', function() {
    const userID = '-123';
    const createdAt = nowUnix() - 1;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = nowUnix();
    const tests = [
      {
        expected: {},
        update: updates[0],
        data: { currentResponsibilityGroup: updates[0] },
        args: [],
        message: 'ignored same group change',
      },
      {
        expected: {
          groupResponsible: updates[1],
          startDate: currentStartDate,
          createdAt,
        },
        update: updates[1],
        data: {
          currentResponsibilityGroup: updates[0],
          currentStartDate,
        },
        args: ['', createdAt],
        message: 'recorded group change',
      },
      {
        expected: {
          groupResponsible: updates[1],
          startDate: currentStartDate,
          createdAt,
          user: userID,
        },
        update: updates[1],
        data: {
          currentResponsibilityGroup: updates[0],
          currentStartDate,
        },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = { currentResponsibilityGroup: update };
      const { responsibilityGroups } = updateDeficientItem(
        model,
        changes,
        ...args
      );
      const actual = responsibilityGroups
        ? responsibilityGroups[Object.keys(responsibilityGroups)[0]]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a new reason incomplete when current reason changes', function() {
    const userID = '-123';
    const createdAt = nowUnix() - 1;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = nowUnix();
    const tests = [
      {
        expected: {},
        update: updates[0],
        data: { currentReasonIncomplete: updates[0] },
        args: [],
        message: 'ignored same group change',
      },
      {
        expected: {
          reasonIncomplete: updates[1],
          startDate: currentStartDate,
          createdAt,
        },
        update: updates[1],
        data: {
          currentReasonIncomplete: updates[0],
          currentStartDate,
        },
        args: ['', createdAt],
        message: 'recorded group change',
      },
      {
        expected: {
          reasonIncomplete: updates[1],
          startDate: currentStartDate,
          createdAt,
          user: userID,
        },
        update: updates[1],
        data: {
          currentReasonIncomplete: updates[0],
          currentStartDate,
        },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem({ ...data, state: 'overdue' });
      const changes = { state: 'incomplete', currentReasonIncomplete: update };
      const { reasonsIncomplete } = updateDeficientItem(
        model,
        changes,
        ...args
      );
      const actual = reasonsIncomplete
        ? reasonsIncomplete[Object.keys(reasonsIncomplete)[0]]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a new start date when current start date changes', function() {
    const createdAt = nowUnix();
    const updates = Array.from(
      { length: 5 },
      (_, i) => (Date.now() + i) / 1000
    );
    const tests = [
      {
        expected: {},
        update: updates[0],
        data: { currentStartDate: updates[0] },
        args: [],
        message: 'ignored same start date change',
      },
      {
        expected: { startDate: updates[1] },
        update: updates[1],
        data: {
          currentStartDate: updates[0],
        },
        args: ['', createdAt],
        message: 'recorded start date change',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = { currentStartDate: update };
      const { startDates } = updateDeficientItem(model, changes, ...args);
      const actual = startDates ? startDates[Object.keys(startDates)[0]] : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('appends a progress note to history when provided', function() {
    const userID = '-123';
    const createdAt = nowUnix();
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = nowUnix();
    const tests = [
      {
        expected: {},
        data: {},
        args: ['', createdAt, ''],
        message: 'ignored unset progress note',
      },
      {
        expected: {
          progressNote: updates[1],
          startDate: currentStartDate,
          createdAt,
        },
        data: { currentStartDate },
        args: ['', createdAt, updates[1]],
        message: 'recorded provided progress note',
      },
      {
        expected: {
          progressNote: updates[1],
          startDate: currentStartDate,
          createdAt,
          user: userID,
        },
        data: { currentStartDate },
        args: [userID, createdAt, updates[1]],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const { progressNotes } = updateDeficientItem(model, {}, ...args);
      const actual = progressNotes
        ? progressNotes[Object.keys(progressNotes)[0]]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('does not modify old progress note history', function() {
    const expected = mocking.createDeficiencyProgressNoteHistory();
    const model = createDeficientItem({
      progressNotes: { expected },
    });
    const { progressNotes } = updateDeficientItem(
      model,
      {},
      '',
      nowUnix(),
      'progress note'
    );
    const actual = progressNotes ? progressNotes.expected : {};
    expect(actual).to.deep.equal(expected);
  });

  it('appends a completed photo to when provided', function() {
    const createdAt = nowUnix() - 1;
    const currentStartDate = nowUnix();
    const updates = Array.from({ length: 2 }, (_, i) =>
      createCompletedPhotosTree(currentStartDate, 1, `${i}`)
    );
    const tests = [
      {
        expected: {},
        data: {},
        args: ['', createdAt, '', null],
        message: 'ignored unset completed photo',
      },
      {
        expected: updates[0],
        data: {},
        args: ['', createdAt, '', updates[0]],
        message: 'recorded provided completed photo',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const { completedPhotos: actual = {} } = updateDeficientItem(
        model,
        {},
        ...args
      );
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('sets deferred state only for specific states and valid dates', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    const badDate = nowUnix();
    const goodDate = nowUnix() + 24 * 60 * 60;
    [
      { data: { state: 'completed' }, expected: false },
      { data: { state: 'incomplete' }, expected: false },
      { data: { state: 'overdue' }, expected: false },
      {
        data: { state: 'requires-action', currentDeferredDate: badDate },
        expected: false,
      },
      {
        data: { state: 'requires-action', currentDeferredDate: goodDate },
        expected: true,
      },
      {
        data: { state: 'go-back', currentDeferredDate: badDate },
        expected: false,
      },
      {
        data: { state: 'go-back', currentDeferredDate: goodDate },
        expected: true,
      },
      {
        data: { state: 'pending', currentDeferredDate: badDate },
        expected: false,
      },
      {
        data: { state: 'pending', currentDeferredDate: goodDate },
        expected: true,
      },
      { data: { state: 'requires-progress-update' }, expected: false },
      { data: { state: 'closed' }, expected: false },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem(data);
      const changes = { state: 'deferred' };
      const updates = updateDeficientItem(model, changes, '', createdAt, '');
      const actual = updates.state === 'deferred';
      expect(actual).to.equal(
        expected,
        `state: ${data.state} was expected to ${
          expected ? '' : 'not '
        }equal deferred with ${
          data.currentDeferredDate === goodDate ? 'good' : 'bad/no'
        } deferred date`
      );
    });
  });

  it('allows updating current deferred date with a valid timestamp', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = Math.round(Date.now() / 1000);
    const changes = { currentDeferredDate: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.currentDeferredDate;
    expect(actual).to.equal(expected);
  });

  it('sets a current deferred due date day from current deferred date', function() {
    const updates = [
      1546300800,
      1557446400,
      1554854400,
      1557360000,
      1589328000,
      1577750400,
    ];

    [
      {
        update: updates[0],
        expected: toLocalDate(new Date(updates[0] * 1000)),
      },
      {
        update: updates[1],
        expected: toLocalDate(new Date(updates[1] * 1000)),
      },
      {
        update: updates[2],
        expected: toLocalDate(new Date(updates[2] * 1000)),
      },
      {
        update: updates[3],
        expected: toLocalDate(new Date(updates[3] * 1000)),
      },
      {
        update: updates[4],
        expected: toLocalDate(new Date(updates[4] * 1000)),
      },
      {
        update: updates[5],
        expected: toLocalDate(new Date(updates[5] * 1000)),
      },
    ].forEach(({ update, expected }) => {
      const model = createDeficientItem({});
      const changes = { currentDeferredDate: update };
      const result = updateDeficientItem(model, changes);
      const actual = result.currentDeferredDateDay;
      expect(actual).to.equal(expected);
    });
  });

  it('only updates current reason incomplete when transitioning to incomplete', function() {
    const tests = [
      {
        state: 'deferred',
        reason: 'oops',
        expected: false,
        msg: 'invalid state',
      },
      {
        state: 'incomplete',
        reason: '',
        expected: false,
        msg: 'invalid update',
      },
      {
        state: 'incomplete',
        reason: 'oops',
        expected: true,
        msg: 'valid update',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { state, reason, expected, msg } = tests[i];
      const model = createDeficientItem({
        state: 'overdue', // valid to transition to incomplete
      });
      const changes = { state, currentReasonIncomplete: reason };
      const updates = updateDeficientItem(model, changes);
      const actual = Boolean(updates.currentReasonIncomplete);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('removes current reason incomplete when transitioning out of incomplete state', function() {
    const tests = [
      {
        data: { state: 'incomplete', currentReasonIncomplete: 'exists' },
        change: { state: 'go-back' },
        expected: null,
        msg: 'removed incompleted on normal transition',
      },
      {
        data: { state: 'incomplete', currentReasonIncomplete: 'exists' },
        change: { state: 'closed' },
        expected: null,
        msg: 'removed incompleted on normal transition',
      },
      {
        data: { state: 'deferred', currentReasonIncomplete: 'exists' },
        change: { state: 'closed' },
        expected: null,
        msg: 'removed incompleted on random transition',
      },
      {
        data: { state: 'completed' },
        change: { state: 'go-back' },
        expected: undefined,
        msg: 'did not remove unexistent reason',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { change, data, expected, msg } = tests[i];
      const model = createDeficientItem(data);
      const updates = updateDeficientItem(model, change);
      const actual = updates.currentReasonIncomplete;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('allows updating complete now reason with a string', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = 'reason complete';
    const changes = { currentCompleteNowReason: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.currentCompleteNowReason;
    expect(actual).to.equal(expected);
  });

  it('allows updating is duplicate with a boolean', function() {
    const model = createDeficientItem({ state: 'requires-action' });
    const expected = false;
    const changes = { isDuplicate: expected };
    const updates = updateDeficientItem(model, changes);
    const actual = updates.isDuplicate;
    expect(actual).to.equal(expected);
  });

  it('appends a new deferred date when current deferred date changes', function() {
    const userID = '-123';
    const createdAt = nowUnix() - 1;
    const updates = Array.from({ length: 5 }, (_, i) =>
      Math.round((Date.now() + i * 1000) / 1000)
    );
    const tests = [
      {
        expected: {},
        update: { currentDeferredDate: updates[0] },
        data: {
          currentDeferredDate: updates[0],
        },
        args: [],
        message: 'ignored same deferred date change',
      },
      {
        expected: {
          createdAt,
          deferredDate: updates[1],
          deferredDateDay: toDate(updates[1]),
        },
        update: {
          currentDeferredDate: updates[1],
          currentDeferredDateDay: toDate(updates[1]),
        },
        data: { currentDeferredDate: updates[0] },
        args: ['', createdAt],
        message: 'recorded deferred date change',
      },
      {
        expected: {
          createdAt,
          deferredDate: updates[1],
          deferredDateDay: toDate(updates[1]),
          user: userID,
        },
        update: { currentDeferredDate: updates[1] },
        data: { currentDeferredDate: updates[0] },
        args: [userID, createdAt],
        message: 'added user when present',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, update, data, args, message } = tests[i];
      const model = createDeficientItem(data);
      const changes = {
        currentDeferredDate: update.currentDeferredDate,
        currentDeferredDateDay: update.currentDeferredDateDay,
      };
      const { deferredDates } = updateDeficientItem(model, changes, ...args);
      const actual = deferredDates
        ? deferredDates[Object.keys(deferredDates)[0]]
        : {};
      expect(actual).to.deep.equal(expected, message);
    }
  });

  it('transitions to each state when valid input provided', function() {
    const createdAt = nowUnix();
    const tomorrow = nowUnix() + 24 * 60 * 60;
    const completedPhoto = createCompletedPhotosTree(tomorrow, 1, '1');
    const tests = [
      {
        data: {
          state: 'requires-action',
        },
        changes: {
          state: 'deferred',
          currentDeferredDate: tomorrow,
        },
        expected: 'deferred',
      },
      {
        data: { state: 'requires-action' },
        changes: {
          state: 'closed',
          currentCompleteNowReason: 'done', // AKA complete now
        },
        expected: 'closed',
      },
      {
        data: { state: 'deferred' },
        changes: { state: 'go-back' },
        expected: 'go-back',
      },
      {
        data: { state: 'deferred' },
        changes: { state: 'closed' }, // AKA duplicate
        expected: 'closed',
      },
      {
        data: { state: 'go-back' },
        changes: {
          state: 'pending',
          currentDueDate: tomorrow,
          currentPlanToFix: 'ok',
          currentResponsibilityGroup: 'site_level_in-house',
        },
        expected: 'pending',
      },
      {
        data: { state: 'go-back' },
        changes: {
          state: 'deferred',
          currentDeferredDate: tomorrow,
        },
        expected: 'deferred',
      },
      {
        data: { state: 'pending' },
        changes: {
          state: 'deferred',
          currentDeferredDate: tomorrow,
        },
        expected: 'deferred',
      },
      // TODO: Move support here
      // {
      //   data: { state: 'pending' },
      //   changes: { state: 'overdue' },
      //   expected: 'overdue',
      // },
      {
        data: { state: 'pending' },
        changes: { state: 'requires-progress-update' },
        expected: 'requires-progress-update',
      },
      {
        data: { state: 'pending', currentStartDate: tomorrow },
        changes: { state: 'completed' },
        completedPhoto,
        expected: 'completed',
      },
      {
        data: { state: 'requires-progress-update' },
        changes: { state: 'pending' },
        progressNote: 'progress',
        expected: 'pending',
      },

      // TODO: Move support here
      // {
      //   data: { state: 'requires-progress-update' },
      //   changes: { state: 'overdue' },
      //   expected: 'overdue',
      // },
      {
        data: { state: 'overdue' },
        changes: {
          state: 'incomplete',
          currentReasonIncomplete: 'not ready',
        },
        expected: 'incomplete',
      },
      {
        data: { state: 'completed' },
        changes: { state: 'go-back' },
        expected: 'go-back',
      },
      {
        data: { state: 'completed' },
        changes: { state: 'closed' },
        expected: 'closed',
      },
      {
        data: { state: 'incomplete' },
        changes: { state: 'go-back' },
        expected: 'go-back',
      },
      {
        data: { state: 'incomplete' },
        changes: { state: 'closed' },
        expected: 'closed',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const {
        data,
        changes,
        progressNote,
        completedPhoto: completedPhotoArg,
        expected,
      } = tests[i];
      const model = createDeficientItem(data);
      const updates = updateDeficientItem(
        model,
        changes,
        '1',
        createdAt,
        progressNote || '',
        completedPhotoArg || null
      );
      const actual = updates.state;
      expect(actual).to.equal(
        expected,
        `transitioned from ${data.state} to ${expected}`
      );
    }
  });
});

/**
 * Create deficiency with default state
 * @param  {Object} config
 * @return {Object}
 */
function createDeficientItem(config = {}) {
  config.state = config.state || 'requires-action';
  if (!config.property) config.property = uuid();
  if (!config.inspection) config.inspection = uuid();
  if (!config.item) config.item = uuid();
  return mocking.createDeficiency(config);
}

/**
 * Convert UNIX timestamp to a MM/DD/YYYY formatted date
 * @param  {Number} unixTimestamp
 * @return {String}
 */
function toDate(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month < 10 ? '0' : ''}${month}/${
    day < 10 ? '0' : ''
  }${day}/${year}`;
}

/**
 * Convert date instance to
 * a MM/DD/YYYY date string
 * @param  {Date|Number} date
 * @return {String}
 */
function toLocalDate(date) {
  const finDate = typeof date === 'number' ? new Date(date * 1000) : date;
  const year = finDate.getFullYear();
  const month = finDate.getMonth() + 1;
  const day = finDate.getDate();
  return `${month < 10 ? '0' : ''}${month}/${
    day < 10 ? '0' : ''
  }${day}/${year}`;
}

/**
 * Create a completed photos history tree
 * @param  {Number} startDate - Current due date of DI
 * @param  {Number?} count - Number of photos to create
 * @param  {String?} user - User identifier
 * @return {Object} - completed photos hash
 */
function createCompletedPhotosTree(startDate, count = 1, user = '') {
  assert(
    startDate && typeof startDate === 'number',
    'has current due date unix timestamp'
  );
  assert(typeof count === 'number' && count > 0, 'has numeric count');

  if (user) {
    assert(typeof user === 'string', 'has valid user identifier');
  }

  const now = Date.now();
  const result = Object.create(null);

  for (let i = 0; i < count; i++) {
    const id = uuid();
    result[id] = {
      caption: getRandom(PROGRESS_NOTES),
      startDate,
      downloadURL: getRandom(DOWNLOAD_URL),
      storageDBPath: getRandom(STORAGE_PATH),
      createdAt: Math.round((now + i) / 1000), // UNIX timestamp
    };

    // Add optional user reference
    if (user) {
      result[id].user = user;
    }
  }

  return result;
}

/**
 * Get random item in array
 * @param  {Any[]} arr
 * @return {Any}
 */
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Current UNIX timestamp
 * @return {Number}
 */
function nowUnix() {
  return Math.round(Date.now() / 1000);
}

/**
 * Convert Date to UNIX
 * @param  {Date} date
 * @return {Number}
 */
function toUnix(date) {
  return Math.round(date.getTime() / 1000);
}
