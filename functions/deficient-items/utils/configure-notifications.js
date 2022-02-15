const assert = require('assert');
const moment = require('moment');
const notifyTemplate = require('../../utils/src-notification-templates');
const clientAppConfig = require('../../config/client-apps');
const findHistory = require('../utils/find-history');
const { getFullName } = require('../../utils/user');
const getUserFriendlyResponsibilityGroup = require('./get-user-friendly-responsibility-group');

const PREFIX = 'deficient-items: utils: configure-notifications:';

module.exports = {
  /**
   * Create Global Notification record
   * configuration object
   * @param {String} progressNote
   * @param {Object} user
   * @param {Object} property
   * @param {Object} deficientItem
   * @return {Object} - notification config
   */
  createProgressNote(progressNote, user, property, deficientItem) {
    assert(
      `${PREFIX} createProgressNoteNotifiction: has progress note`,
      progressNote && typeof progressNote === 'string'
    );
    assert(
      `${PREFIX} createProgressNoteNotifiction: has user`,
      user && typeof user === 'object'
    );
    assert(
      `${PREFIX} createProgressNoteNotifiction: has property`,
      property && typeof property === 'object'
    );
    assert(
      `${PREFIX} createProgressNoteNotifiction: has deficiency`,
      deficientItem && typeof deficientItem === 'object'
    );

    const propertyName = property.name || 'Unknown Property';
    const title = deficientItem.itemTitle || 'Unknown Item';
    const section = deficientItem.sectionTitle || '';
    const subSection = deficientItem.sectionSubtitle || '';
    const dueDateDay = deficientItem.currentDueDateDay || '';
    const currentResponsibilityGroup = getUserFriendlyResponsibilityGroup(
      deficientItem.currentResponsibilityGroup
    );
    const currentPlanToFix = deficientItem.currentPlanToFix || '';
    const authorName = getFullName(user) || 'Unknown User';
    const authorEmail = user.email || 'Missing Email';
    const authorId = user.id;

    const result = {
      title: propertyName,
      summary: notifyTemplate('deficient-item-progress-note-summary', {
        title,
        authorName,
        authorEmail,
      }),
      markdownBody: notifyTemplate(
        'deficient-item-progress-note-markdown-body',
        {
          progressNote,
          title,
          section,
          subSection,
          dueDateDay,
          currentPlanToFix,
          currentResponsibilityGroup,
          authorName,
          authorEmail,
        }
      ),
      property: property.id,
    };

    if (authorId) {
      result.creator = authorId;
    }

    return result;
  },

  /**
   * Create Global Notification
   * when Deficient Item's state changed
   * or a non-state update was saved
   * @param  {String} previousState
   * @param  {Object} user
   * @param  {Object} property
   * @param  {Object} deficientItem
   * @return {Object} - notification config
   */
  createDeficiencyUpdate(previousState, user, property, deficientItem) {
    assert(
      `${PREFIX} createDeficiencyUpdateNotification: has previous state`,
      previousState && typeof previousState === 'string'
    );
    assert(
      `${PREFIX} createDeficiencyUpdateNotification: has user`,
      user && typeof user === 'object'
    );
    assert(
      `${PREFIX} createDeficiencyUpdateNotification: has property`,
      property && typeof property === 'object'
    );
    assert(
      `${PREFIX} createDeficiencyUpdateNotification: has deficiency`,
      deficientItem && typeof deficientItem === 'object'
    );

    const currentState = deficientItem.state || '';
    let updatedAt = deficientItem.updatedAt;
    if (updatedAt instanceof Date) {
      updatedAt = Math.round(updatedAt.getTime() / 1000);
    }

    const propertyName = property.name || 'Unknown Property';
    const title = deficientItem.itemTitle || 'Unknown Item';
    const section = deficientItem.sectionTitle || '';
    const subSection = deficientItem.sectionSubtitle || '';
    const currentDueDateDay = deficientItem.currentDueDateDay || '';
    const currentDeferredDateDay = deficientItem.currentDeferredDateDay || '';
    const currentPlanToFix = deficientItem.currentPlanToFix || '';
    const currentResponsibilityGroup = getUserFriendlyResponsibilityGroup(
      deficientItem.currentResponsibilityGroup
    );
    const currentCompleteNowReason =
      deficientItem.currentCompleteNowReason || '';
    const currentReasonIncomplete = deficientItem.currentReasonIncomplete || '';
    const url = `${clientAppConfig.deficientItemPath}`
      .replace('{{propertyId}}', property.id)
      .replace('{{deficientItemId}}', deficientItem.id);
    const trelloUrl = deficientItem.trelloCardURL || '';
    const authorName = getFullName(user) || 'Unknown User';
    const authorEmail = user.email || 'Missing Email';
    const authorId = user.id;

    // Collect latest progress note details
    const latestProgressNote = findHistory(deficientItem)('progressNotes')
      .previous;
    let currentProgressNote = '';
    let progressNoteDateDay = '';
    if (latestProgressNote) {
      currentProgressNote = latestProgressNote.progressNote;
      progressNoteDateDay = moment
        .unix(latestProgressNote.createdAt)
        .format('MM/DD/YY');
    }

    let summary = '';
    let markdownBody = '';

    // Create state change notification
    if (previousState && currentState && previousState !== currentState) {
      summary = notifyTemplate('deficient-item-state-change-summary', {
        title,
        previousState,
        state: currentState,
        authorName,
      });

      markdownBody = notifyTemplate(
        'deficient-item-state-change-markdown-body',
        {
          previousState,
          state: currentState,
          title,
          section,
          subSection,
          currentDueDateDay,
          currentDeferredDateDay,
          currentPlanToFix,
          currentResponsibilityGroup,
          currentProgressNote,
          progressNoteDateDay,
          currentCompleteNowReason,
          currentReasonIncomplete,
          url,
          trelloUrl,
          authorName,
          authorEmail,
        }
      );
    } else {
      summary = notifyTemplate('deficient-item-update-summary', {
        title,
        authorName,
      });
      markdownBody = notifyTemplate('deficient-item-update-markdown-body', {
        title,
        section,
        subSection,
        currentDueDateDay,
        currentDeferredDateDay,
        currentPlanToFix,
        currentResponsibilityGroup,
        currentProgressNote,
        progressNoteDateDay,
        currentCompleteNowReason,
        currentReasonIncomplete,
        url,
        trelloUrl,
        authorName,
        authorEmail,
      });
    }

    const result = {
      title: propertyName,
      summary,
      markdownBody,
      property: property.id,
    };

    if (authorId) {
      result.creator = authorId;
    }

    return result;
  },
};
