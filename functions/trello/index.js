const createOnUpsertTrelloTokenHandler = require('./on-create-request-handler');
const createOnGetAllTrelloBoardsHandler = require('./get-all-trello-boards-handler');
const createOnGetAllTrelloBoardListsHandler = require('./get-all-trello-board-lists-handler');
const createOnTrelloDeficientItemCardHandler = require('./create-trello-deficient-item-card-handler');
const createDeleteTrelloAuthHandler = require('./delete-trello-auth-handler');
const createCloseDiCard = require('./pubsub/close-deficient-item-card');
const createCommentForDiState = require('./pubsub/create-comment-for-deficient-item-state');
const createUpdateDueDate = require('./pubsub/update-card-due-date');

module.exports = {
  createOnUpsertTrelloTokenHandler,
  createOnGetAllTrelloBoardsHandler,
  createOnGetAllTrelloBoardListsHandler,
  createOnTrelloDeficientItemCardHandler,
  createDeleteTrelloAuthHandler,

  pubsub: {
    createCloseDiCard,
    createCommentForDiState,
    createUpdateDueDate,
  },
};
