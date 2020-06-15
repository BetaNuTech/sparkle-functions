const assert = require('assert');
const moment = require('moment');
const log = require('../../utils/logger');
const config = require('../../config');
const model = require('../../models/deficient-items');
const notificationsModel = require('../../models/notifications');
const processPropertyMeta = require('../../properties/utils/process-meta');
const propertiesModel = require('../../models/properties');
const { forEachChild } = require('../../utils/firebase-admin');
const notifyTemplate = require('../../utils/src-notification-templates');
const findHistory = require('../utils/find-history');

const PREFIX = 'deficient-items: pubsub: sync-overdue:';
const FIVE_DAYS_IN_SEC = 432000;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;

/**
 * Sync Deficient items from "pending" to "overdue"
 * and update associated property metadata
 * @param  {String} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param  {String} deficientItemUrl
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncOverdueDeficientItems(
  topic = '',
  pubsub,
  db,
  fs,
  deficientItemUrl
) {
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(Boolean(pubsub), 'has pubsub instance');
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');
  assert(
    deficientItemUrl && typeof deficientItemUrl === 'string',
    'has DI URL template'
  );

  return pubsub
    .topic(topic)
    .onPublish(async function syncOverdueDeficientItemsHandler() {
      const now = Math.round(Date.now() / 1000);

      await forEachChild(
        db,
        '/propertyInspectionDeficientItems',
        async function proccessDIproperties(propertyId) {
          await forEachChild(
            db,
            `/propertyInspectionDeficientItems/${propertyId}`,
            async function processDeficientItems(
              defItemId,
              diItem,
              diItemSnap
            ) {
              let { state } = diItem;
              const previousState = state;
              const currentStartDate = diItem.currentStartDate || 0;
              const currentDueDate = diItem.currentDueDate || 0;
              const willRequireProgressNote =
                diItem.willRequireProgressNote || false;

              // Eligible for "requires-progress-update" state
              // when due date is at least 5 days from the start date
              const isRequiresProgressUpdateStateEligible =
                FIVE_DAYS_IN_SEC <= currentDueDate - currentStartDate;

              // Second measurements until DI becomes "overdue"
              const secondsUntilDue = currentDueDate - now;
              const secondsUntilHalfDue =
                (currentDueDate - currentStartDate) / 2;

              if (
                OVERDUE_ELIGIBLE_STATES.includes(state) &&
                secondsUntilDue <= 0
              ) {
                // Progress state
                state = 'overdue';
                diItem.state = 'overdue';

                log.info(
                  `${PREFIX} ${topic}: property "${propertyId}" deficiency "${defItemId}" is now overdue`
                );

                try {
                  await model.updateState(db, fs, diItemSnap, state);
                } catch (err) {
                  throw Error(
                    `${PREFIX} failed to update state overdue | ${err}`
                  );
                }

                try {
                  // Sync DI's changes to its' property's metadata
                  await propertiesModel.updateMetaData(fs, propertyId);
                } catch (err) {
                  log.error(
                    `${PREFIX} failed to upate firestore property meta of overdue | ${err}`
                  );
                }

                try {
                  // Sync DI's changes to its' property's metadata
                  await processPropertyMeta(db, propertyId);
                } catch (err) {
                  log.error(
                    `${PREFIX} failed to upate realtime property meta of overdue | ${err}`
                  );
                }
              } else if (
                state === 'pending' &&
                isRequiresProgressUpdateStateEligible &&
                secondsUntilDue < secondsUntilHalfDue &&
                willRequireProgressNote
              ) {
                // Progress state
                state = 'requires-progress-update';
                diItem.state = 'requires-progress-update';

                try {
                  await model.updateState(db, fs, diItemSnap, state);
                  log.info(
                    `${PREFIX} ${topic}: property "${propertyId}" and deficient item "${defItemId}" has deficiency requires progress update`
                  );
                } catch (err) {
                  throw Error(
                    `${PREFIX} failed to update state requires-progress-update | ${err}`
                  );
                }
              }

              // If state change occurred create
              // a global notification Deficient
              // Item state change
              if (previousState !== state) {
                try {
                  const propertySnap = await propertiesModel.findRecord(
                    db,
                    propertyId
                  );
                  const property = propertySnap.val();

                  const title = diItem.itemTitle;
                  const section = diItem.sectionTitle || '';
                  const subSection = diItem.sectionSubtitle || '';
                  const currentDueDateDay = diItem.currentDueDateDay || '';
                  const currentDeferredDateDay =
                    diItem.currentDeferredDateDay || '';
                  const currentPlanToFix = diItem.currentPlanToFix || '';
                  const currentResponsibilityGroup = diItem.currentResponsibilityGroup
                    ? RESPONSIBILITY_GROUPS[diItem.currentResponsibilityGroup]
                    : '';
                  const currentCompleteNowReason =
                    diItem.currentCompleteNowReason || '';
                  const currentReasonIncomplete =
                    diItem.currentReasonIncomplete || '';
                  const trelloUrl = diItem.trelloCardURL;

                  // Create url for deficient item
                  const url = deficientItemUrl
                    .replace('{{propertyId}}', propertyId)
                    .replace('{{deficientItemId}}', defItemId);

                  // Collect any progress note data
                  const progressNoteHistory = findHistory(diItem)(
                    'progressNotes'
                  );
                  const latestProgressNote = progressNoteHistory
                    ? progressNoteHistory.current
                    : null;
                  let currentProgressNote = '';
                  let progressNoteDateDay = '';
                  if (latestProgressNote) {
                    currentProgressNote = latestProgressNote.progressNote;
                    progressNoteDateDay = moment
                      .unix(latestProgressNote.createdAt)
                      .format('MM/DD/YY');
                  }

                  await notificationsModel.createSrc(db, {
                    title: property.name,
                    summary: notifyTemplate(
                      'deficient-item-state-change-summary',
                      {
                        title,
                        previousState,
                        state,
                      }
                    ),
                    markdownBody: notifyTemplate(
                      'deficient-item-state-change-markdown-body',
                      {
                        previousState,
                        state,
                        title,
                        section,
                        subSection,
                        currentDeferredDateDay,
                        currentDueDateDay,
                        currentPlanToFix,
                        currentResponsibilityGroup,
                        currentProgressNote,
                        progressNoteDateDay,
                        currentCompleteNowReason,
                        currentReasonIncomplete,
                        url,
                        trelloUrl,
                      }
                    ),
                    creator: '',
                    property: propertyId,
                  });
                } catch (err) {
                  log.error(
                    `${PREFIX} failed to create source notification | ${err}`
                  ); // proceed with error
                }
              }
            }
          );
        }
      );
    });
};
