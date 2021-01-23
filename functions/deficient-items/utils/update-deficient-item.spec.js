const assert = require('assert');
const { expect } = require('chai');
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
  it('it removes "current" DI attributes when set as go-back', function() {
    const model = createDeficientItem({
      state: 'requires-action',
      currentPlanToFix: 'test',
      currentReasonIncomplete: 'test',
      currentDueDateDay: '1/2/20',
      currentResponsibilityGroup: 'in house',
      currentStartDate: Date.now() / 1000,
      currentDeferredDate: Date.now() / 1000,
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
      expect(actual).to.equal(null, `removed any ${attr}`);
    });
  });

  it('it sets a current due date day from current due date', function() {
    const updates = [
      new Date(1546300800000),
      new Date(1557446400000),
      new Date(1554854400000),
      new Date(1557360000000),
      new Date(1589328000000),
      new Date(1577750400000),
    ];

    [
      { update: updates[0], expected: toLocalDate(updates[0]) },
      { update: updates[1], expected: toLocalDate(updates[1]) },
      { update: updates[2], expected: toLocalDate(updates[2]) },
      { update: updates[3], expected: toLocalDate(updates[3]) },
      { update: updates[4], expected: toLocalDate(updates[4]) },
      { update: updates[5], expected: toLocalDate(updates[5]) },
    ].forEach(({ update, expected }) => {
      const model = createDeficientItem({});
      const changes = { currentDueDate: update };
      const result = updateDeficientItem(model, changes);
      const actual = result.currentDueDateDay;
      expect(actual).to.equal(expected);
    });
  });

  it('it sets pending state only when specific states are active', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    [
      { data: 'completed', expected: false },
      { data: 'incomplete', expected: false },
      { data: 'overdue', expected: false },
      { data: 'requires-action', expected: true },
      { data: 'go-back', expected: true },
      { data: 'requires-progress-update', expected: true },
      { data: 'closed', expected: false },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: data });
      const changes = {
        currentDueDate: new Date(),
        currentResponsibilityGroup: 'corporate_manages_vendor',
        currentPlanToFix: 'fix',
      };
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

  it('it appends a stateHistory entry when pending state is set', function() {
    const user = uuid();
    const createdAt = (Date.now() - 1000) / 1000;
    const expected = { state: 'pending', user, createdAt };
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      currentDueDate: new Date(),
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
    expect(actual).to.equal(expected);
  });

  it('it sets current start date when updated to pending', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      currentDueDate: new Date(),
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

  it('it uses updated current start date setting history hash start dates', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    const model = createDeficientItem({ state: 'requires-action' });
    const changes = {
      currentDueDate: new Date(),
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

  it('it sets pending state on go-back or requires-action only when model requirements met', function() {
    const createdAt = (Date.now() - 1000) / 1000;
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
      const changes = {};
      if (data.includes('currentDueDate')) {
        changes.currentDueDate = new Date();
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
      expect(actual).to.equal.strictEqual(
        expected,
        `state: ${data} was expected to ${expected ? '' : 'not '}equal pending`
      );
    });
  });

  it('it sets when progress note is required for a pending state transition', function() {
    const pendingReadyDI = {
      currentResponsibilityGroup: 'corporate_manages_vendor',
      currentPlanToFix: 'fix',
    };
    const now = new Date();
    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    const sixDaysFromNow = new Date();
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
    const createdAt = (now.getTime() - 1000) / 1000;
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
      const updates = updateDeficientItem(
        model,
        {},
        '',
        createdAt,
        progressNote
      );
      const actual = updates.willRequireProgressNote;
      expect(actual).to.equal(expected, msg);
    });
  });

  it('it sets incomplete state only when specific state(s) are active', function() {
    const createdAt = (Date.now() - 1000) / 1000;
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
      const changes = { currentReasonIncomplete: 'woopsy' };
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

  it('it sets incomplete state on overdue only when model requirements met', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    [
      { data: [], expected: false },
      { data: ['currentReasonIncomplete'], expected: true },
    ].forEach(({ data, expected }) => {
      const model = createDeficientItem({ state: 'overdue' });
      const changes = {};
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

  it('it appends a stateHistory entry when incomplete state is set', function() {
    const user = uuid();
    const createdAt = (Date.now() - 1000) / 1000;
    const expected = { state: 'incomplete', user, createdAt };
    const model = createDeficientItem({ state: 'overdue' });
    const changes = { currentReasonIncomplete: 'woopsy' };
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
    expect(actual).to.equal(expected);
  });

  it('it appends a new item to state history when state changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const tests = [
      {
        expected: null,
        update: 'requires-action',
        data: { state: 'requires-action' },
        args: [],
        message: 'ignored same state change',
      },
      {
        expected: { state: 'go-back', createdAt },
        update: 'go-back',
        data: { state: 'requires-action' },
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
        data: { state: 'requires-action' },
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
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new item to due dates when current due date changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from(
      { length: 5 },
      (_, i) => (Date.now() + i) / 1000
    );
    const currentStartDate = Date.now() / 1000;
    const tests = [
      {
        expected: null,
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
      const actual = dueDates ? dueDates[Object.keys(dueDates)[0]] : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new item to plans to fix when current plan changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = Date.now() / 1000;
    const tests = [
      {
        expected: null,
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
      const actual = plansToFix ? plansToFix[Object.keys(plansToFix)[0]] : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new item to complete now reasons when current plan changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const tests = [
      {
        expected: null,
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
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new responsiblity group when current group changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = Date.now() / 1000;
    const tests = [
      {
        expected: null,
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
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new reason incomplete when current reason changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = Date.now() / 1000;
    const tests = [
      {
        expected: null,
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
      const model = createDeficientItem(data);
      const changes = { currentReasonIncomplete: update };
      const { reasonsIncomplete } = updateDeficientItem(
        model,
        changes,
        ...args
      );
      const actual = reasonsIncomplete
        ? reasonsIncomplete[Object.keys(reasonsIncomplete)[0]]
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a new start date when current start date changes', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from(
      { length: 5 },
      (_, i) => (Date.now() + i) / 1000
    );
    const tests = [
      {
        expected: null,
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
      const actual = startDates ? startDates[Object.keys(startDates)[0]] : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a progress note to history when provided', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from({ length: 5 }, (_, i) => `${i}`);
    const currentStartDate = Date.now() / 1000;
    const tests = [
      {
        expected: null,
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
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it appends a completed photo to when provided', function() {
    const createdAt = (Date.now() - 1000) / 1000;
    const currentStartDate = Date.now() / 1000;
    const updates = Array.from({ length: 2 }, (_, i) =>
      createCompletedPhotosTree(currentStartDate, 1, `${i}`)
    );
    const tests = [
      {
        expected: null,
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
      const { completedPhotos: actual } = updateDeficientItem(
        model,
        {},
        ...args
      );
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });

  it('it sets a current deferred due date day from current deferred date', function() {
    const updates = [
      new Date(1546300800000),
      new Date(1557446400000),
      new Date(1554854400000),
      new Date(1557360000000),
      new Date(1589328000000),
      new Date(1577750400000),
    ];

    [
      { update: updates[0], expected: toLocalDate(updates[0]) },
      { update: updates[1], expected: toLocalDate(updates[1]) },
      { update: updates[2], expected: toLocalDate(updates[2]) },
      { update: updates[3], expected: toLocalDate(updates[3]) },
      { update: updates[4], expected: toLocalDate(updates[4]) },
      { update: updates[5], expected: toLocalDate(updates[5]) },
    ].forEach(({ update, expected }) => {
      const model = createDeficientItem({});
      const changes = { currentDeferredDate: update };
      const result = updateDeficientItem(model, changes);
      const actual = result.currentDeferredDateDay;
      expect(actual).to.equal(expected);
    });
  });

  it('it appends a new item to deferred dates when current deferred date changes', function() {
    const userID = '-123';
    const createdAt = (Date.now() - 1000) / 1000;
    const updates = Array.from(
      { length: 5 },
      (_, i) => (Date.now() + i) / 1000
    );
    const tests = [
      {
        expected: null,
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
        expected: { createdAt, deferredDate: updates[1], user: userID },
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
        : null;
      if (actual) {
        expect(actual).to.deep.equal(expected, message);
      } else {
        expect(actual).to.equal(expected, message);
      }
    }
  });
});

function createDeficientItem(deficientItem = {}) {
  deficientItem.state = deficientItem.state || 'requires-action';
  return deficientItem;
}

/**
 * Convert UNIX timestamp to a MM/DD/YYYY formatted date
 * @param  {Number} unixTimestamp
 * @return {String}
 */
function toDate(unixTimestamp) {
  const dateParts = new Date(parseFloat(unixTimestamp) * 1000)
    .toISOString()
    .split('T')[0]
    .split('-');
  return `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
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
 * @param  {Number} currentDueDate - Current due date of DI
 * @param  {Number?} count - Number of photos to create
 * @param  {String?} user - User identifier
 * @return {Object} - completed photos hash
 */
function createCompletedPhotosTree(currentDueDate, count = 1, user = '') {
  assert(
    currentDueDate && typeof currentDueDate === 'number',
    'has "currentDueDate" unix timestamp'
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
      startDate: currentDueDate - i * 10000,
      downloadURL: getRandom(DOWNLOAD_URL),
      storageDBPath: getRandom(STORAGE_PATH),
      createdAt: (now + i) / 1000, // UNIX timestamp
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
