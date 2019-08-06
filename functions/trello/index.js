const createOnUpsertTrelloTokenHandler = require('./on-create-request-handler');
const createOnGetAllTrelloBoardsHandler = require('./get-all-trello-boards-handler');
const createOnGetAllTrelloBoardListsHandler = require('./get-all-trello-board-lists-handler');
const createOnTrelloDeficientItemCardHandler = require('./create-trello-deficient-item-card-handler');
const createGetTrelloAuthorizorHandler = require('./get-trello-authorizor-handler');

module.exports = {
  createOnUpsertTrelloTokenHandler,
  createOnGetAllTrelloBoardsHandler,
  createOnGetAllTrelloBoardListsHandler,
  createOnTrelloDeficientItemCardHandler,
  createGetTrelloAuthorizorHandler,
};
