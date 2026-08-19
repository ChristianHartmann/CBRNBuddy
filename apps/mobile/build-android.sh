#!/usr/bin/env bash
# Build Android with JDK 17 (required by React Native/Gradle)
#
# Usage:
#   ./build-android.sh          # Debug build (__DEV__=true, Backend OCR)
#   ./build-android.sh release  # Release build (__DEV__=false, ML Kit OCR)

# JDK 17 is required by React Native and Gradle. Point JAVA_HOME at your own install,
# or export it before calling this script.
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")}"

if [ "$1" = "release" ]; then
  shift
  exec npx expo run:android --variant release "$@"
else
  exec npx expo run:android "$@"
fi
