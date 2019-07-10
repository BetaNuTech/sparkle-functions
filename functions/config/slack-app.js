const { SLACK_CLIENT_SECRET } = process.env;

if (!SLACK_CLIENT_SECRET) {
  throw Error('SLACK_CLIENT_SECRET not set in Environment');
}

module.exports = {
  clientId: '148699982064.678105000770',
  clientSecret: SLACK_CLIENT_SECRET,
};
