// Runs after electron-builder packs the app: switches off Electron features
// that are commonly abused to tamper with or debug a shipped app.
const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function afterPack(context) {
  const name = context.packager.appInfo.productFilename;
  const platform = context.electronPlatformName;
  let exe;
  if (platform === 'win32') exe = path.join(context.appOutDir, `${name}.exe`);
  else if (platform === 'darwin') exe = path.join(context.appOutDir, `${name}.app`);
  else return;
  await flipFuses(exe, {
    version: FuseVersion.V1,
    // Unsigned Mac builds need a fresh ad-hoc signature after the binary changes (Apple Silicon refuses to run otherwise).
    resetAdHocDarwinSignature: platform === 'darwin',
    [FuseV1Options.RunAsNode]: false, // ELECTRON_RUN_AS_NODE cannot turn the app into plain Node.js
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // NODE_OPTIONS cannot inject code
    [FuseV1Options.EnableNodeCliInspectArguments]: false, // --inspect debugger flags are ignored
    [FuseV1Options.OnlyLoadAppFromAsar]: true, // app code must come from the packed archive
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true, // needed for offline fonts and AI models
  });
  console.log(`  • fuses applied  file=${exe}`);
};
