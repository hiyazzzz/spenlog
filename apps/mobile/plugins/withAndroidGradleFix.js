const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: Fix AgpVersionAttr mismatch in EAS Android builds.
 *
 * Root cause:
 *   Community RN packages (gesture-handler, async-storage, etc.) declare
 *   older AGP versions (e.g. 8.10.1) in their own buildscript blocks.
 *   EAS uses AGP 8.11.0 (via react-native-gradle-plugin transitive dep).
 *   Gradle's AgpVersionAttr requires ALL sub-projects to match the consumer's
 *   AGP version => "No matching variant" error on :app dependency resolution.
 *
 * Fix:
 *   Add pluginManagement.resolutionStrategy to android/settings.gradle so that
 *   every com.android.* plugin application (com.android.library, etc.) resolves
 *   to AGP 8.11.0 across the entire multi-project build.
 */
const withAndroidGradleFix = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const settingsGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'settings.gradle'
      );

      if (!fs.existsSync(settingsGradlePath)) {
        console.warn('[withAndroidGradleFix] settings.gradle not found, skipping');
        return config;
      }

      let contents = fs.readFileSync(settingsGradlePath, 'utf8');

      // Already patched
      if (contents.includes('com.android.tools.build:gradle:8.11.0')) {
        return config;
      }

      const resolutionStrategy = `
  resolutionStrategy {
    eachPlugin {
      if (requested.id.id.startsWith("com.android.")) {
        useModule("com.android.tools.build:gradle:8.11.0")
      }
    }
  }
`;

      // Insert resolutionStrategy inside pluginManagement, before its closing brace.
      // The expo-generated settings.gradle always ends pluginManagement with:
      //   includeBuild(expoPluginsPath)
      // }
      const anchor = '  includeBuild(expoPluginsPath)\n}';
      if (contents.includes(anchor)) {
        contents = contents.replace(anchor, `  includeBuild(expoPluginsPath)\n${resolutionStrategy}}`);
        fs.writeFileSync(settingsGradlePath, contents, 'utf8');
        console.log('[withAndroidGradleFix] Patched settings.gradle: forced AGP 8.11.0 via pluginManagement.resolutionStrategy');
      } else {
        console.warn('[withAndroidGradleFix] Expected anchor not found in settings.gradle — skipping patch');
        console.warn('  Expected: ' + JSON.stringify(anchor));
      }

      return config;
    },
  ]);
};

module.exports = withAndroidGradleFix;
