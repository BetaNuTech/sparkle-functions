const log = require('../utils/logger');
const { db } = require('./setup'); // eslint-disable-line
const propertiesModel = require('../models/properties');
const templatesModel = require('../models/templates');

(async () => {
  const updates = [];
  const propertyTemplates = {};
  let propertiesSnap = null;

  try {
    propertiesSnap = await propertiesModel.findAll(db);
  } catch (err) {
    console.error(`Failed to lookup all properties | ${err}`); // eslint-disable-line
    throw err;
  }

  // Add missing property associations
  // to templates
  propertiesSnap.docs.forEach(doc => {
    const propertyData = doc.data();
    const templateIds = Object.keys(propertyData.templates || {});
    const hasTemplates = templateIds.length;
    propertyTemplates[doc.id] = templateIds;

    if (hasTemplates) {
      updates.push({ id: doc.id, templates: templateIds });
    }
  });

  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];

    try {
      await templatesModel.updatePropertyRelationships(
        db,
        update.id,
        [], // Before no templates
        update.templates
      );
    } catch (err) {
      console.error(`Failed to sync property ${update.id} templates | ${err}`); // eslint-disable-line
    }
  }

  let templatesSnap = null;

  try {
    templatesSnap = await templatesModel.findAll(db);
  } catch (err) {
    console.error(`Failed to lookup all templates | ${err}`); // eslint-disable-line
    throw err;
  }

  // Remove property associations from templates
  const removalUpdates = flatten(
    templatesSnap.map(doc => {
      const templateId = doc.id;
      const templateData = doc.data();

      const removed = (templateData.properties || []).filter(propId => {
        const propTemplates = propertyTemplates[propId] || [];
        return !propTemplates.includes(templateId);
      });

      return removed.map(propId => ({ id: propId, templates: [templateId] }));
    })
  );

  for (let i = 0; i < removalUpdates.length; i++) {
    const update = removalUpdates[i];

    try {
      await templatesModel.updatePropertyRelationships(
        db,
        update.id,
        update.templates,
        [] // After no templates
      );
    } catch (err) {
      /* eslint-disable */
      console.error(
        `Failed to sync template ${update.templates.join(
          ''
        )} properties | ${err}`
      );
      /* eslint-enable */
    }
  }

  log.info('Completed property templates sync successfully');
  process.exit();
})();

function flatten(arr) {
  return [].concat(...arr);
}
