const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Bundle the YOLO TFLite model (apps/mobile/assets/models/*.tflite) as an asset - CBRN-72
config.resolver.assetExts.push('tflite');

module.exports = withNativeWind(config, { input: './global.css' });
