const config = {
  web: {
    stagingDomain: 'https://sleepy-cliffs-61733.herokuapp.com',
    productionDomain: 'https://sparkle-production.herokuapp.com',
    deficientItemPath:
      'properties/{{propertyId}}/deficient-items/{{deficientItemId}}',

    get stagingDeficientItemURL() {
      return `${this.stagingDomain}/${this.deficientItemPath}`;
    },

    get productionDeficientItemURL() {
      return `${this.productionDomain}/${this.deficientItemPath}`;
    },
  },
};

module.exports = config;
