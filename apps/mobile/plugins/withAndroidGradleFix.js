const { withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

const AGP_VERSION = '8.11.0';

/**
 * Expo config plugin: Fix "No variants exist" on EAS Android builds in pnpm monorepos.
 *
 * ROOT CAUSE:
 *   @react-native/gradle-plugin@0.81.5 bundles AGP 8.11.0 via an includeBuild composite
 *   build. This sets AgpVersionAttr = '8.11.0' on :app variants. Community RN packages
 *   (gesture-handler, async-storage, screens, etc.) use the OLD `apply plugin:
 *   'com.android.library'` style and inherit AGP from the root buildscript classpath.
 *   The stock CNG root build.gradle doesn't declare AGP in buildscript.dependencies,
 *   so community packages produce variants with a different (or absent) AgpVersionAttr.
 *   Result: "No matching variant of project :XYZ -- No variants exist."
 *
 * FIX (two layers):
 *   1. Root build.gradle  -- add classpath('com.android.tools.build:gradle:8.11.0') so
 *      ALL sub-projects inherit AGP 8.11.0 from the parent classloader.
 *   2. settings.gradle    -- add gradle.allprojects resolutionStrategy to forcibly pin
 *      AGP 8.11.0 in every sub-project buildscript even if they declare their own.
 */
const withAndroidGradleFix = (config) => {

  // Fix 1: Patch root build.gradle to pin AGP in buildscript classpath
  config = withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (contents.includes('com.android.tools.build:gradle:' + AGP_VERSION)) {
      return mod; // Already patched
    }

    const agpClasspath = '    classpath("com.android.tools.build:gradle:' + AGP_VERSION + '")';

    if (contents.includes('dependencies {')) {
      contents = contents.replace(
        /(\bdependencies\s*\{)/,
        '$1\n' + agpClasspath
      );
    } else if (contents.includes('buildscript {')) {
      contents = contents.replace(
        /(\bbuildscript\s*\{)/,
        '$1\n  dependencies {\n' + agpClasspath + '\n  }'
      );
    } else {
      contents =
        'buildscript {\n  repositories {\n    google()\n    mavenCentral()\n  }\n  dependencies {\n' +
        agpClasspath +
        '\n  }\n}\n\n' +
        contents;
    }

    console.log('[withAndroidGradleFix] Patched build.gradle: added classpath AGP ' + AGP_VERSION);
    mod.modResults.contents = contents;
    return mod;
  });

  // Fix 2: Patch settings.gradle to pin AGP in all sub-project buildscripts
  config = withSettingsGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (contents.includes('Pin AGP') || contents.includes('AgpVersionAttr')) {
      return mod; // Already patched
    }

    const pin = [
      '',
      '// Pin AGP ' + AGP_VERSION + ' across all sub-project buildscript classpaths.',
      '// Without this, community RN packages (gesture-handler, async-storage, etc.) inherit',
      '// a different AGP version than :app, causing AgpVersionAttr mismatch ->',
      '// "No variants exist" at dependency resolution time.',
      'gradle.allprojects { proj ->',
      '  proj.buildscript.configurations.all { cfg ->',
      '    cfg.resolutionStrategy.eachDependency { details ->',
      '      if (details.requested.group == \'com.android.tools.build\'',
      '          && details.requested.name == \'gradle\') {',
      '        details.useVersion(\'' + AGP_VERSION + '\')',
      '        details.because(\'Pin AGP ' + AGP_VERSION + ' to match :app AgpVersionAttr\')',
      '      }',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    console.log('[withAndroidGradleFix] Patched settings.gradle: added gradle.allprojects AGP pin');
    mod.modResults.contents = contents + pin;
    return mod;
  });

  return config;
};

module.exports = withAndroidGradleFix;
