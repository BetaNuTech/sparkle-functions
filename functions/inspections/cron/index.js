const syncPropertyInspectionproxies = require('./sync-property-inspection-proxies');
const syncCompletedInspectionproxies = require('./sync-completed-inspection-proxies');
const cleanupProxyOrphans = require('./cleanup-proxy-orphans');

module.exports = {
  cleanupProxyOrphans,
  syncCompletedInspectionproxies,
  syncPropertyInspectionproxies,
};
