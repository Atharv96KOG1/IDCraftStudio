// Runs after electron-builder packs the app: switches off Electron features
// that are commonly abused to tamper with or debug a shipped app.
const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false, // ELECTRON_RUN_AS_NODE cannot turn the app into plain Node.js
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // NODE_OPTIONS cannot inject code
    [FuseV1Options.EnableNodeCliInspectArguments]: false, // --inspect debugger flags are ignored
    [FuseV1Options.OnlyLoadAppFromAsar]: true, // app code must come from the packed archive
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true, // needed for offline fonts and AI models
  });
  console.log(`  • fuses applied  file=${exe}`);
};
