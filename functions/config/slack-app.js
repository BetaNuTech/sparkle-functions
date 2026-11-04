const { SLACK_CLIENT_SECRET, SLACK_CLIENT_ID } = process.env;

if (!SLACK_CLIENT_SECRET) {
  console.warn(
    'Warning: "SLACK_CLIENT_SECRET" not set in system or Firebase Environment'
  );
}

if (!SLACK_CLIENT_ID) {
  console.warn(
    'Warning: "SLACK_CLIENT_ID" not set in system or Firebase Environment'
  );
}

module.exports = {
  clientId: SLACK_CLIENT_ID,
  clientSecret: SLACK_CLIENT_SECRET,
};
