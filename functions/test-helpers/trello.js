const { expect } = require('chai');
const systemModel = require('../models/system');
const deficiencyModel = require('../models/deficient-items');

module.exports = {
  /**
   * Has removed all references to a
   * Deficient Item's Trello card
   * @param  {admin.firestore} db
   * @param  {String}  propertyTrelloCardsPath - ie /system/integrations/<uid>/trello/properties/<property-id>/cards/<card-id>
   * @param  {String}  deficientItemPath       - ie /propertyInspectionDeficientItems/<property-id>/<def-item-id>
   * @return {Promise}
   */
  async hasRemovedDeficiencyCardReferences(
    db,
    propertyId,
    deficiencyId,
    cardId
  ) {
    const trelloCardDetailsSnap = await systemModel.findTrelloProperty(
      db,
      propertyId
    );
    const actualTrelloCardDetails = Boolean(
      ((trelloCardDetailsSnap.data() || {}).cards || {})[cardId]
    );
    const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
    const actualTrelloCardUrl = Boolean(
      (deficiencySnap.data() || {}).trelloCardURL
    );

    // Assertions
    expect(actualTrelloCardDetails).to.equal(
      false,
      'deleted card has been removed from system'
    );
    expect(actualTrelloCardUrl).to.equal(
      false,
      "deleted Trello card URL from its' deficiency"
    );
  },
};
