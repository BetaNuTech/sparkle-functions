const CLIENT_DOMAIN = process.env.CLIENT_DOMAIN || '';

const config = {
  web: {
    deficientItemPath:
      'properties/{{propertyId}}/deficient-items/edit/{{deficientItemId}}/',

    deficientItemsPath: 'properties/{{propertyId}}/deficient-items/',

    inspectionPath:
      'properties/{{propertyId}}/inspections/edit/{{inspectionId}}/',

    jobPath: 'properties/{{propertyId}}/jobs/edit/{{jobId}}',

    get deficientItemURL() {
      return `${CLIENT_DOMAIN}/${this.deficientItemPath}`;
    },

    get deficientItemsURL() {
      return `${CLIENT_DOMAIN}/${this.deficientItemsPath}`;
    },

    get inspectionURL() {
      return `${CLIENT_DOMAIN}/${this.inspectionPath}`;
    },

    get jobURL() {
      return `${CLIENT_DOMAIN}/${this.jobPath}`;
    },
  },
};

module.exports = config;
