#!/usr/bin/env bash
# Build Android with JDK 17 (required by React Native/Gradle)
#
# Usage:
#   ./build-android.sh                    # Debug build, __DEV__ on and verbose tracing
#   ./build-android.sh release            # Release build, what an installed app runs
#   ./build-android.sh release --device   # ... and pick the target from a list
#
# Always build onto a real device. The camera and the GPU frame processing do not work in
# an emulator, and with one configured `expo run:android` selects it without asking. Worse,
# a failed emulator start still exits zero, so the failure looks like a successful build.

# JDK 17 is required by React Native and Gradle. Point JAVA_HOME at your own install,
# or export it before calling this script.
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")}"

if [ "$1" = "release" ]; then
  shift
  exec npx expo run:android --variant release "$@"
else
  exec npx expo run:android "$@"
fi
