const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-widgets 56.0.23 adds aps-environment even when
 * enablePushNotifications is false. The photo widget does not use push
 * updates, so remove that unintended entitlement after expo-widgets runs.
 */
module.exports = function withExpoWidgetsNoPush(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
