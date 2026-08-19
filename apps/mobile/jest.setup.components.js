// Expo installs the WinterCG globals as lazy getters that require their module on first
// read. Jest's teardown resets the module registry and then reads those globals again, at
// a point where requiring is no longer allowed, so the getter throws "You are trying to
// `import` a file outside of the scope of the test code". The suite has already passed by
// then, but the teardown error replaces the result and the suite is reported as failed.
//
// Reading the globals here, inside the test scope, materialises them while requiring still
// works, so no getter is left for the teardown to trigger.
[
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'structuredClone',
  '__ExpoImportMetaRegistry',
].forEach((name) => {
  void globalThis[name];
});
