const config = {
  web: {
    stagingDomain: 'https://sleepy-cliffs-61733.herokuapp.com',
    productionDomain: 'https://sparkle-production.herokuapp.com',
    deficientItemPath:
      'properties/{{propertyId}}/deficient-items/{{deficientItemId}}',

    inspectionPath:
      'properties/{{propertyId}}/update-inspection/{{inspectionId}}',

    get stagingDeficientItemURL() {
      return `${this.stagingDomain}/${this.deficientItemPath}`;
    },

    get productionDeficientItemURL() {
      return `${this.productionDomain}/${this.deficientItemPath}`;
    },

    get stagingInspectionURL() {
      return `${this.stagingDomain}/${this.inspectionPath}`;
    },

    get productionInspectionURL() {
      return `${this.productionDomain}/${this.inspectionPath}`;
    },
  },
};

module.exports = config;
