const log = require('../utils/logger');
const { fs } = require('./setup'); // eslint-disable-line
const templatesModel = require('../models/templates');

(async () => {
  const updates = [];
  let propertiesSnap = null;

  try {
    propertiesSnap = await fs.collection('properties').get();
  } catch (err) {
    console.error(`Failed to lookup all properties | ${err}`); // eslint-disable-line
    throw err;
  }

  propertiesSnap.docs.forEach(doc => {
    const propertyData = doc.data();
    const templateIds = Object.keys(propertyData.templates || {});
    const hasTemplates = templateIds.length;

    if (hasTemplates) {
      updates.push({ id: doc.id, templates: templateIds });
    }
  });

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];

    try {
      await templatesModel.updatePropertyRelationships(
        fs,
        update.id,
        [], // Before no templates
        update.templates
      );
    } catch (err) {
      console.error(`Failed to sync property ${update.id} templates | ${err}`); // eslint-disable-line
    }
  }

  // TODO lookup all templates and remove
  // properties that are no longer associated

  log.info('Completed property templates sync successfully');
  process.exit();
})();
