// Default Expo config. The only addition is the screenshot build (screenshots/README.md): with
// SCREENSHOTS=1, web builds load Skia before the app and keep files in memory instead of on disk.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.SCREENSHOTS === '1') {
  const web = path.join(__dirname, 'screenshots', 'web');
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web') {
      if (moduleName === 'expo-file-system') return { type: 'sourceFile', filePath: path.join(web, 'expo-file-system.js') };
      if (moduleName === 'expo-router/entry-classic' && /expo-router[\\/]entry\.js$/.test(context.originModulePath)) {
        return { type: 'sourceFile', filePath: path.join(web, 'entry.js') };
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
