const log = require('../utils/logger');
const { fs: db } = require('./setup'); // eslint-disable-line
const systemModel = require('../models/system');
const slack = require('../services/slack');

(async () => {
  let accessToken = '';

  try {
    const slackSnap = await systemModel.firestoreFindSlack(db);
    const credentials = slackSnap.data() || null;
    accessToken = credentials.accessToken || '';
  } catch (err) {
    log.error(`Slack credential lookup failed | ${err}`);
    throw err;
  }

  if (!accessToken) throw Error('Slack access token not set');

  let payload = null;

  try {
    payload = await slack.listChannels(accessToken);
  } catch (err) {
    log.error(`Slack channel lookup failed | ${err}`);
    throw err;
  }

  console.log(payload);

  log.info('Slack channels list fetch succeeded');
  process.exit();
})();
