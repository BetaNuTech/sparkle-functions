const { SLACK_CLIENT_SECRET } = process.env;

if (!SLACK_CLIENT_SECRET) {
  throw Error('SLACK_CLIENT_SECRET not set in Environment');
}

module.exports = {
  clientId: '3817900792.677820426034',
  clientSecret: SLACK_CLIENT_SECRET,
};
