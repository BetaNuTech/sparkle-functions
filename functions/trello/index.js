const createOnUpsertTrelloTokenHandler = require('./on-create-request-handler');
const createOnGetAllTrelloBoardsHandler = require('./get-all-trello-boards-handler');
const createOnGetAllTrelloBoardListsHandler = require('./get-all-trello-board-lists-handler');
const createOnTrelloDeficientItemCardHandler = require('./create-trello-deficient-item-card-handler');
const createDeleteTrelloAuthHandler = require('./delete-trello-auth-handler');
const createCloseDiCard = require('./pubsub/close-deficient-item-card');
const createCommentForDiState = require('./pubsub/create-comment-for-deficient-item-state');
const createUpdateDueDate = require('./pubsub/update-card-due-date');
const createOnCreateDICompletedPhoto = require('./on-create-deficient-item-completed-photo');
const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const getBoards = require('./api/get-boards');
const getBoardLists = require('./api/get-board-lists');
const postDeficiencyCard = require('./api/post-deficiency-card');

module.exports = {
  createOnUpsertTrelloTokenHandler,
  createOnGetAllTrelloBoardsHandler,
  createOnGetAllTrelloBoardListsHandler,
  createOnTrelloDeficientItemCardHandler,
  createDeleteTrelloAuthHandler,
  createOnCreateDICompletedPhoto,

  pubsub: {
    createCloseDiCard,
    createCommentForDiState,
    createUpdateDueDate,
  },

  api: {
    postAuth,
    deleteAuth,
    getBoards,
    getBoardLists,
    postDeficiencyCard,
  },
};
