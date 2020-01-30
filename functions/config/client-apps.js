const config = {
  web: {
    deficientItemPath:
      'properties/{{propertyId}}/deficient-items/{{deficientItemId}}',

    inspectionPath:
      'properties/{{propertyId}}/update-inspection/{{inspectionId}}',

    get deficientItemURL() {
      return `${process.env.CLIENT_DOMAIN}/${this.deficientItemPath}`;
    },

    get inspectionURL() {
      return `${process.env.CLIENT_DOMAIN}/${this.inspectionPath}`;
    },
  },
};

module.exports = config;
