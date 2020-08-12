const { expect } = require('chai');
const systemModel = require('../models/system');
const deficiencyModel = require('../models/deficient-items');

module.exports = {
  /**
   * Has removed all references to a
   * Deficient Item's Trello card
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyTrelloCardsPath - ie /system/integrations/<uid>/trello/properties/<property-id>/cards/<card-id>
   * @param  {String}  deficientItemPath       - ie /propertyInspectionDeficientItems/<property-id>/<def-item-id>
   * @return {Promise}
   */
  async hasRemovedDiCardReferences(
    db,
    propertyTrelloCardsPath,
    deficientItemPath
  ) {
    const trelloCardDetailsSnap = await db
      .ref(propertyTrelloCardsPath)
      .once('value');
    const actualTrelloCardDetails = trelloCardDetailsSnap.exists();
    const trelloCardURLSnap = await db
      .ref(`${deficientItemPath}/trelloCardURL`)
      .once('value');
    const actualTrelloCardUrl = trelloCardURLSnap.exists();

    // Assertions
    expect(actualTrelloCardDetails).to.equal(
      false,
      'deleted card has been removed from trello integration'
    );
    expect(actualTrelloCardUrl).to.equal(
      false,
      'deleted Trello card URL from its deficient item'
    );
  },

  /**
   * Has removed all references to a
   * Deficient Item's Trello card
   * @param  {admin.firestore} fs
   * @param  {String}  propertyTrelloCardsPath - ie /system/integrations/<uid>/trello/properties/<property-id>/cards/<card-id>
   * @param  {String}  deficientItemPath       - ie /propertyInspectionDeficientItems/<property-id>/<def-item-id>
   * @return {Promise}
   */
  async hasRemovedDeficiencyCardReferences(
    fs,
    propertyId,
    deficiencyId,
    cardId
  ) {
    const trelloCardDetailsSnap = await systemModel.firestoreFindTrelloProperty(
      fs,
      propertyId
    );
    const actualTrelloCardDetails = Boolean(
      ((trelloCardDetailsSnap.data() || {}).cards || {})[cardId]
    );
    const deficiencySnap = await deficiencyModel.firestoreFindRecord(
      fs,
      deficiencyId
    );
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

  /**
   * DI's Completed Photo entry has an attachment ID
   * @param  {firebase.database} db
   * @param  {String} deficientItemPath
   * @param  {String} trelloAttachmentId
   * @return {Promise} - resolve {Boolean}
   */
  async hasAddTrelloAttachmentId(db, deficientItemPath, trelloAttachmentId) {
    const completedPhotos = await db
      .ref(`${deficientItemPath}/completedPhotos`)
      .once('value');

    const [completedPhoto] = Object.values(completedPhotos.val() || {}).filter(
      ({ trelloCardAttachement }) =>
        trelloCardAttachement === trelloAttachmentId
    );

    return Boolean(completedPhoto);
  },
};
