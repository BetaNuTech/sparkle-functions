const assert = require('assert');
const moment = require('moment');
const log = require('../../utils/logger');
const config = require('../../config');
const notifyTemplate = require('../../utils/src-notification-templates');
const findHistory = require('../utils/find-history');
const propertyModel = require('../../models/properties');
const deficiencyModel = require('../../models/deficient-items');
const notificationsModel = require('../../models/notifications');
const updateDeficiency = require('../utils/update-deficient-item');

const PREFIX = 'deficiency: pubsub: sync-overdue-v2:';
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;
const DEF_ITEM_URI = config.clientApps.web.deficientItemURL;

/**
 * Sync all eligible deficiencies to
 * "overdue" and update the property's metadata
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @param  {String?} deficiencyUrl
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncOverdueDeficientItems(
  fs,
  pubsub,
  topic = '',
  deficiencyUrl = DEF_ITEM_URI
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');
  assert(
    deficiencyUrl && typeof deficiencyUrl === 'string',
    'has DI URL template'
  );

  return pubsub
    .topic(topic)
    .onPublish(async function syncOverdueDeficienciesHandler() {
      const propertyCache = {};
      const propertyMetaUpdates = [];
      const batch = fs.batch();
      const propertyBatch = fs.batch();

      // Lookup all deficiencies that
      // may be eligible for overdue status
      let deficiencies = null;
      try {
        const collectionSnap = await deficiencyModel.query(fs, {
          state: ['in', OVERDUE_ELIGIBLE_STATES],
        });

        deficiencies = collectionSnap.docs;
      } catch (err) {
        throw Error(`${PREFIX} failed to lookup deficiencies | ${err}`);
      }

      for (let i = 0; i < deficiencies.length; i++) {
        const deficiencyId = deficiencies[i].id;
        const deficiency = deficiencies[i].data();
        let { state } = deficiency;
        const previousState = state;
        const { property: propertyId } = deficiency;
        const updates = updateDeficiency(deficiency, {});

        // Transition deficiencies that are
        // overdue or require a progress update
        if (
          updates.state === 'overdue' ||
          updates.state === 'requires-progress-update'
        ) {
          state = updates.state;
          deficiency.state = updates.state;
          log.info(
            `${PREFIX} deficiency "${deficiencyId}" is now "${updates.state}"`
          );

          try {
            await deficiencyModel.updateRecord(
              fs,
              deficiencyId,
              updates,
              batch
            );
          } catch (err) {
            log.error(
              `${PREFIX} failed to update deficiency: "${deficiencyId}" state to: "${updates.state}" | ${err}`
            );
            // continue to next deficiency
            continue; // eslint-disable-line
          }
        }

        // Queue property for meta data syncing
        // for only the overdue deficienices
        if (
          updates.state === 'overdue' &&
          !propertyMetaUpdates.includes(propertyId)
        ) {
          propertyMetaUpdates.push(propertyId);
        }

        // If state change was set above create
        // a global notification for Deficiency's
        // state change
        if (previousState !== state) {
          let property = propertyCache[propertyId] || null;

          if (!property) {
            try {
              const propertySnap = await propertyModel.findRecord(
                fs,
                propertyId
              );
              property = propertySnap.data();
              if (!property) throw Error('invalid record');
              propertyCache[propertyId] = property; // Add to cache
            } catch (err) {
              log.error(
                `${PREFIX} property: "${propertyId}" lookup failed | ${err}`
              );
              // Continue without creating notification
              continue; // eslint-disable-line
            }
          }

          const title = deficiency.itemTitle;
          const section = deficiency.sectionTitle || '';
          const subSection = deficiency.sectionSubtitle || '';
          const currentDueDateDay = deficiency.currentDueDateDay || '';
          const currentDeferredDateDay =
            deficiency.currentDeferredDateDay || '';
          const currentPlanToFix = deficiency.currentPlanToFix || '';
          const currentResponsibilityGroup = deficiency.currentResponsibilityGroup
            ? RESPONSIBILITY_GROUPS[deficiency.currentResponsibilityGroup]
            : '';
          const currentCompleteNowReason =
            deficiency.currentCompleteNowReason || '';
          const currentReasonIncomplete =
            deficiency.currentReasonIncomplete || '';
          const trelloUrl = deficiency.trelloCardURL;

          // Create url for deficient item
          const url = deficiencyUrl
            .replace('{{propertyId}}', propertyId)
            .replace('{{deficientItemId}}', deficiencyId);

          // Collect any progress note data
          const progressNoteHistory = findHistory(deficiency)('progressNotes');
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

          try {
            await notificationsModel.createRecord(
              fs,
              undefined, // auto generate ID
              {
                title: property.name,
                summary: notifyTemplate('deficient-item-state-change-summary', {
                  title,
                  previousState,
                  state,
                }),
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
              },
              batch
            );
          } catch (err) {
            log.error(`${PREFIX} failed to create notification | ${err}`); // proceed with error
          }
        }
      }

      // Atomically commit deficiency/notification writes
      try {
        await batch.commit();
      } catch (err) {
        throw Error(
          `${PREFIX} failed to commit deficiency/notification database writes | ${err}`
        );
      }

      // Once deficiency updates are committed
      // update all out-of-date properties' metadata
      for (let i = 0; i < propertyMetaUpdates.length; i++) {
        const propertyId = propertyMetaUpdates[i];

        try {
          await propertyModel.updateMetaData(fs, propertyId, propertyBatch);
        } catch (err) {
          log.error(
            `${PREFIX} failed to upate property: "${propertyId}" meta data for overdue | ${err}`
          );
          // Continue updating properties
          continue; // eslint-disable-line
        }
      }

      try {
        await propertyBatch.commit();
      } catch (err) {
        throw Error(
          `${PREFIX} failed to commit property database writes | ${err}`
        );
      }
    });
};
