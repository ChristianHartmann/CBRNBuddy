// Two projects, because the two kinds of test need incompatible setups.
//
// "logic" covers calculations, database and scanner code. It is plain TypeScript, runs
// under ts-jest in a node environment and stays fast, which matters because it holds the
// safety critical assertions and gets run constantly.
//
// "components" renders React Native components and needs the jest-expo preset to
// transform the native modules. That preset is considerably slower to boot, so it only
// covers *.rntl.test.tsx.
const jestExpoPreset = require('jest-expo/jest-preset');

// jest-expo hands babel-jest a Metro caller, which drops babel-jest's own
// supportsDynamicImport: false. Babel then leaves `import()` untouched and the CommonJS test
// VM throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG, making every screen behind
// React.lazy untestable. Putting the flag back turns the dynamic import into a require again.
// The rest of the preset's babel options, its config file above all, must be kept.
const SOURCE_PATTERN = '\\.[jt]sx?$';
const [presetBabelJest, presetBabelOptions] = jestExpoPreset.transform[SOURCE_PATTERN];
const componentsTransform = {
  ...jestExpoPreset.transform,
  [SOURCE_PATTERN]: [
    presetBabelJest,
    { ...presetBabelOptions, caller: { ...presetBabelOptions.caller, supportsDynamicImport: false }, plugins: ['@babel/plugin-transform-dynamic-import'] },
  ],
  // metro.config.js registers tflite as an asset extension; jest-expo's preset does not know
  // it. Without this, requiring the model binary is parsed as JavaScript and any test that
  // reaches model-source.ts dies on the first byte of the .tflite file.
  '^.+\\.tflite$': require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
};

module.exports = {
  projects: [
    {
      displayName: 'logic',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
      testMatch: ['**/*.test.ts'],
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      testMatch: ['**/*.rntl.test.tsx'],
      transform: componentsTransform,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.components.js'],
    },
  ],
};
