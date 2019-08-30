const { expect } = require('chai');

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
};
