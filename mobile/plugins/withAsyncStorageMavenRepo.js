const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @expo: async-storage local_repo';

/**
 * Async Storage 3.x declares `api "org.asyncstorage.shared_storage:storage-android:1.0.0"` but ships
 * the AAR only under `android/local_repo`. Gradle resolves dependencies from the root project's
 * repositories, so that local Maven repo must be registered here or release builds fail (e.g. on EAS).
 */
function withAsyncStorageMavenRepo(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (contents.includes(MARKER)) {
      return modConfig;
    }

    const block = `
    ${MARKER}
    maven {
      url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo"
    }`;

    const jitpack = "maven { url 'https://www.jitpack.io' }";
    if (!contents.includes(jitpack)) {
      throw new Error(
        'withAsyncStorageMavenRepo: android/build.gradle missing expected jitpack repository line; update the plugin matcher.',
      );
    }

    contents = contents.replace(jitpack, `${jitpack}${block}`);
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withAsyncStorageMavenRepo;
