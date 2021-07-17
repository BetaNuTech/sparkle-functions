const assert = require('assert');
const config = require('../config');
const uuid = require('./uuid');
const createDeficiencies = require('../deficient-items/utils/create-deficient-items');

const INSPECTION_SCORES = config.inspectionItems.scores;
const DEFICIENT_LIST_ELIGIBLE = config.inspectionItems.deficientListEligible;
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;
const DEFICIENCY_STATES = config.deficientItems.allStates;

function nowUnix() {
  return Math.round(Date.now() / 1000);
}

module.exports = {
  /**
   * Create a property
   * @param  {Object?} propConfig
   * @return {Object}
   */
  createProperty(propConfig = {}) {
    const finalConfig = JSON.parse(JSON.stringify(propConfig));

    if (propConfig.templates && Array.isArray(propConfig.templates)) {
      finalConfig.templates = {};
      propConfig.templates.forEach(tmplId => {
        finalConfig.templates[tmplId] = true;
      });
    }

    if (propConfig.inspections && Array.isArray(propConfig.inspections)) {
      finalConfig.inspections = {};
      propConfig.inspections.forEach(inspId => {
        finalConfig.inspections[inspId] = true;
      });
    }

    return {
      name: 'test property',
      zip: '32003',
      ...finalConfig,
    };
  },

  /**
   * Create a team
   * @param  {Object?} teamConfig
   * @return {Object}
   */
  createTeam(teamConfig = {}) {
    const finalConfig = JSON.parse(JSON.stringify(teamConfig));

    if (teamConfig.properties && Array.isArray(teamConfig.properties)) {
      finalConfig.properties = {};
      teamConfig.properties.forEach(tmplId => {
        finalConfig.properties[tmplId] = true;
      });
    }

    return {
      name: 'test team',
      ...finalConfig,
    };
  },

  /**
   * Create a randomized inspection object
   * @param  {Object} config
   * @return {Object}
   */
  createInspection(inspConfig) {
    assert(Boolean(inspConfig.property, 'config has `property` id'));

    const now = nowUnix();
    const offset = Math.floor(Math.random() * 100);
    const items = Math.floor(Math.random() * 100);
    const completed = inspConfig.inspectionCompleted || false;
    const templateName =
      inspConfig.templateName ||
      (inspConfig.template && inspConfig.template.name) ||
      `test-${offset * 3}`;

    return Object.assign(
      {
        creationDate: now - offset,
        completionDate: completed ? now - offset + 1000 : 0,
        deficienciesExist: Math.random() > 0.5,
        inspectionCompleted: completed,
        inspector: `user-${offset * 2}`,
        inspectorName: 'test-user',
        itemsCompleted: completed ? items : items / 2,
        score: Math.random() > 0.5 ? 100 : Math.random(),
        templateName,
        template: {
          trackDeficientItems: false,
          name: templateName,
          sections: {},
          items: {},
        },
        totalItems: items,
        updatedLastDate: Math.round(now - offset / 2),
      },
      inspConfig
    );
  },

  createItem(itemConfig = {}) {
    assert(Boolean(itemConfig.sectionId), 'has config with sectionId');

    return Object.assign(
      {
        index: 0,
        isItemNA: false,
        isTextInputItem: true,
        mainInputFourValue: 0,
        mainInputOneValue: 0,
        mainInputSelected: true,
        mainInputThreeValue: 0,
        mainInputTwoValue: 0,
        mainInputZeroValue: 3,
        sectionId: itemConfig.sectionId,
        textInputValue: '1',
        title: 'Unit #:',
      },
      itemConfig
    );
  },

  /**
   * Create completed main input type item
   * allow setting for deficient for given type
   * @param  {String}  type
   * @param  {Boolean} deficient
   * @param  {Object}  item
   * @return {Object} - completed main input item object
   */
  createCompletedMainInputItem(
    type = 'twoactions_checkmarkx',
    deficient = false,
    item = {}
  ) {
    assert(Boolean(INSPECTION_SCORES[type]), 'has valid main input type');
    assert(typeof deficient === 'boolean', 'has boolean deficient');
    assert(item && typeof item === 'object', 'has object item');

    // Validate mocked selection or
    // lookup selection based on deficiency
    // list eligiblity
    let selection = 0;
    if (typeof item.mainInputSelection === 'number') {
      assert(
        ITEM_VALUE_NAMES[item.mainInputSelection],
        'has valid main input selection'
      );
      assert(
        typeof INSPECTION_SCORES[type][item.mainInputSelection] === 'number',
        'has valid score selection'
      );
      selection = item.mainInputSelection;
    } else if (DEFICIENT_LIST_ELIGIBLE[type]) {
      selection = DEFICIENT_LIST_ELIGIBLE[type].lastIndexOf(deficient) || 0;
    } else {
      selection = null;
    }

    const itemValues = {
      mainInputZeroValue: 0,
      mainInputOneValue: 0,
      mainInputTwoValue: 0,
      mainInputThreeValue: 0,
      mainInputFourValue: 0,
    };

    INSPECTION_SCORES[type].forEach((score, i) => {
      itemValues[ITEM_VALUE_NAMES[i]] = score;
    });

    return Object.assign(
      {
        deficient,
        index: 0,
        isItemNA: false,
        itemType: 'main',
        isTextInputItem: false,
        mainInputSelected: true,
        mainInputSelection: selection,
        mainInputType: type,
        sectionId: '-uK6',
        textInputValue: '',
        title: 'e',
        notes: true,
        photos: true,
      },
      itemValues,
      item
    );
  },

  createDeficientItem(inspectionId, itemId, item = {}) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(itemId && typeof itemId === 'string', 'has item id');
    assert(item && typeof item === 'object', 'has object item');

    return Object.assign(
      {
        state: 'requires-action', // TODO #81
      },
      item,
      {
        inspection: inspectionId,
        item: itemId,
      }
    );
  },

  /**
   * Create a mock firestore deficiency
   * @param  {Object} defConfig
   * @param  {Object?} sourceInspection
   * @param  {Object?} sourceItem
   * @return {Object}
   */
  createDeficiency(defConfig, sourceInspection, sourceItem) {
    assert(defConfig && typeof defConfig === 'object', 'has config object');
    const { inspection, item, property } = defConfig;
    assert(
      inspection && typeof inspection === 'string',
      'config has inspection id'
    );
    assert(item && typeof item === 'string', 'config has item id');
    assert(property && typeof property === 'string', 'config has property id');

    const itemConfig =
      sourceItem ||
      this.createCompletedMainInputItem('twoactions_checkmarkx', true);
    const inspectionConfig =
      sourceInspection ||
      this.createInspection({
        deficienciesExist: true,
        inspectionCompleted: true,
        property,
        template: {
          trackDeficientItems: true,
          items: {
            // Create single deficient item on inspection
            [item]: itemConfig,
          },
        },
      });

    // Create deficiency from inspection
    const deficiencies = createDeficiencies({
      ...inspectionConfig,
      id: inspection,
    });

    // Overwrite generated state with config
    return { ...deficiencies[item], ...defConfig };
  },

  /**
   * Create a deficiency's state history entry
   * @param  {Object?} histConfig
   * @return {Object}
   */
  createDeficiencyStateHistory(histConfig = {}) {
    return {
      state:
        DEFICIENCY_STATES[Math.floor(Math.random() * DEFICIENCY_STATES.length)],
      user: uuid(),
      createdAt: nowUnix(),
      ...histConfig,
    };
  },

  /**
   * Create ap progress note
   * history entry
   * @param {Object?} histConfig
   * @return {Object}
   */
  createDeficiencyProgressNoteHistory(histConfig = {}) {
    return {
      user: uuid(),
      createdAt: nowUnix(),
      progressNote: 'note',
      ...histConfig,
    };
  },

  createSection(sectionConfig = {}) {
    return Object.assign(
      {
        added_multi_section: false,
        index: 0,
        section_type: 'single',
        title: 'Intro',
      },
      sectionConfig
    );
  },

  /**
   * Create system's slack credentials
   * @param  {Object} credConfig
   * @return {Object}
   */
  createSlackCredentials(credConfig = {}) {
    return {
      accessToken: 'token',
      scope: 'scope',
      createdAt: nowUnix(), // Unix timestamp
      updatedAt: nowUnix(), // Unix timestamp
      ...credConfig,
    };
  },

  /**
   * Create public facing Slack integration
   * @param  {Object?} intConfig
   * @param  {Object?} channelsConfig
   * @return {Object}
   */
  createSlackIntegration(intConfig = {}, channelsConfig = null) {
    const integration = {
      createdAt: nowUnix(),
      grantedBy: uuid(), // Sparkle user
      defaultChannelName: 'default-channel',
      team: uuid(), // Slack team ID
      teamName: 'Slack Team',
      joinedChannelNames: {},
      ...intConfig,
    };

    if (channelsConfig) {
      integration.joinedChannelNames = { ...channelsConfig };
    }

    return integration;
  },

  /**
   * Create user
   * @param  {Object?} credConfig
   * @return {Object}
   */
  createUser(userConfig = {}) {
    return {
      firstName: 'first',
      lastName: 'last',
      email: 'test@email.com',
      pushOptOut: false,
      admin: false,
      corporate: false,
      lastUserAgent: 'web',
      createdAt: nowUnix(), // Unix timestamp
      lastSignInDate: nowUnix() - 10000,
      ...userConfig,
    };
  },

  /**
   * Create system Trello credentials
   * @param  {Object?} credConfig
   * @return {Object}
   */
  createTrelloCredentials(credConfig = {}) {
    return {
      authToken: 'token',
      apikey: 'key',
      user: uuid(),
      createdAt: nowUnix(), // Unix timestamp
      updatedAt: nowUnix(), // Unix timestamp
      ...credConfig,
    };
  },

  /**
   * Create public facing Trello integration
   * @param  {Object?} intConfig
   * @return {Object}
   */
  createPropertyTrelloIntegration(intConfig = {}) {
    return {
      grantedBy: uuid(),
      updatedAt: nowUnix(), // UNIX timestamp
      openBoard: uuid(),
      openBoardName: 'open board',
      openList: uuid(),
      openListName: 'open list',
      closedBoard: uuid(),
      closedBoardName: 'closed board',
      closedList: uuid(),
      closedListName: 'closed list',
      ...intConfig,
    };
  },

  /**
   * Create a default notification record
   * @param  {Object?} noteConfig
   * @param  {Object?} slackConfig
   * @param  {Object?} pushConfig
   * @return {Object}
   */
  createNotification(noteConfig = {}, slackConfig = null, pushConfig = null) {
    const notification = {
      title: 'title',
      summary: 'summary',
      creator: uuid(),
      property: '',
      markdownBody: '',
      userAgent: '',

      publishedMediums: {
        slack: false,
        push: false,
      },

      ...noteConfig,
    };

    if (slackConfig) {
      notification.slack = { ...slackConfig };
    }

    if (pushConfig) {
      notification.push = { ...pushConfig };
      notification.unpublishedPush = Object.keys(notification.push).length;
    } else {
      notification.unpublishedPush = 0;
    }

    return notification;
  },

  /**
   * Create mock admin edit entry
   * for an inspection item
   * @param  {Object} config
   * @return {Object}
   */
  createInspItemAdminEdit(adminEditConfig = {}) {
    return {
      action: 'selected X',
      admin_name: 'Test Admin',
      admin_uid: uuid(),
      edit_date: nowUnix(),
      ...adminEditConfig,
    };
  },

  /**
   * Create a valid job
   * @param  {Object} jobConfig
   * @return {Object}
   */
  createJob(jobConfig = {}) {
    if (jobConfig.property) {
      assert(
        jobConfig.property.id,
        'has required firestore "property" document reference'
      );
    }

    return {
      title: 'test job',
      need: 'test',
      scopeOfWork: '1. fix it',
      trelloCardURL: 'trello.com/card/1',
      createdAt: nowUnix(),
      updatedAt: nowUnix(),
      state: config.jobs.stateTypes[0],
      type: config.jobs.typeValues[0],
      authorizedRules: config.jobs.authorizedRuleTypes[0],
      ...jobConfig,
    };
  },

  nowUnix,
};
