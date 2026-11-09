/**
 * Solace AI - Native Module Defensive Shims Postinstall Script
 *
 * Automatically applies try-catch guards around `requireNativeModule` for
 * expo-clipboard, expo-av, and expo-speech so that EAS preview APKs missing
 * these native libraries in classes.dex do not crash React Native on startup.
 *
 * If the native modules ARE compiled into the binary, requireNativeModule
 * succeeds and returns the real native module directly.
 */

const fs = require('fs');
const path = require('path');

const shims = [
  {
    path: path.join(__dirname, '..', 'node_modules', 'expo-clipboard', 'build', 'ExpoClipboard.js'),
    content: `import { NativeModule, requireNativeModule } from 'expo';
export const clipboardEventName = 'onClipboardChanged';
let clipboardModule = null;
try {
  clipboardModule = requireNativeModule('ExpoClipboard');
} catch (e) {
  clipboardModule = {
    isAvailable: false,
    getStringAsync: async () => '',
    setStringAsync: async () => {
      console.warn('[ExpoClipboard] Native module unavailable in this build. Clipboard copy is disabled.');
      return false;
    },
    hasStringAsync: async () => false,
    getImageAsync: async () => null,
    setImageAsync: async () => false,
    hasImageAsync: async () => false,
    addClipboardListener: () => ({ remove: () => {} }),
    removeClipboardListener: () => {},
  };
}
export default clipboardModule;
//# sourceMappingURL=ExpoClipboard.js.map
`,
  },
  {
    path: path.join(__dirname, '..', 'node_modules', 'expo-av', 'build', 'ExponentAV.js'),
    content: `import { requireNativeModule } from 'expo-modules-core';
let ExponentAV = null;
try {
  ExponentAV = requireNativeModule('ExponentAV');
} catch (e) {
  ExponentAV = {
    isAvailable: false,
    setAudioIsEnabled: async () => {},
    getPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
    requestPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
    getAudioRecordingStatus: async () => ({ canRecord: false, isRecording: false, durationMillis: 0 }),
    prepareAudioRecorder: async () => {
      throw new Error('[ExponentAV] Native audio recording module not compiled into this build. Please use keyboard draft mode.');
    },
    startAudioRecording: async () => {
      throw new Error('[ExponentAV] Audio recording unavailable without native ExponentAV module.');
    },
    pauseAudioRecording: async () => ({ canRecord: false, isRecording: false, durationMillis: 0 }),
    stopAudioRecording: async () => ({ canRecord: false, isRecording: false, durationMillis: 0 }),
    unloadAudioRecorder: async () => {},
    getAvailableInputs: async () => [],
    getCurrentInput: async () => null,
    setInput: async () => {},
    getStatusForSound: async () => ({ isLoaded: false, error: 'Native audio playback module not available in this build.' }),
    loadForSound: async () => {
      throw new Error('[ExponentAV] Audio playback unavailable without native ExponentAV module.');
    },
    replaySound: async () => ({ isLoaded: false }),
    setAudioModeAsync: async () => {},
    addListener: () => ({ remove: () => {} }),
    removeListeners: () => {},
  };
}
export default ExponentAV;
//# sourceMappingURL=ExponentAV.js.map
`,
  },
  {
    path: path.join(__dirname, '..', 'node_modules', 'expo-av', 'build', 'ExpoVideoManager.js'),
    content: `import { requireNativeModule } from 'expo-modules-core';
let ExpoVideoManager = null;
try {
  ExpoVideoManager = requireNativeModule('ExpoVideoView');
} catch (e) {
  ExpoVideoManager = {
    isAvailable: false,
    setFullscreen: async () => {},
  };
}
export default ExpoVideoManager;
//# sourceMappingURL=ExpoVideoManager.js.map
`,
  },
  {
    path: path.join(__dirname, '..', 'node_modules', 'expo-av', 'build', 'ExponentVideo.js'),
    content: `import { requireNativeViewManager } from 'expo-modules-core';
let ExponentVideo = null;
try {
  ExponentVideo = requireNativeViewManager('ExpoVideoView');
} catch (e) {
  ExponentVideo = 'View';
}
export default ExponentVideo;
//# sourceMappingURL=ExponentVideo.js.map
`,
  },
  {
    path: path.join(__dirname, '..', 'node_modules', 'expo-speech', 'build', 'ExponentSpeech.js'),
    content: `import { requireNativeModule } from 'expo';
let ExpoSpeech = null;
try {
  ExpoSpeech = requireNativeModule('ExpoSpeech');
} catch (e) {
  ExpoSpeech = {
    isAvailable: false,
    speak: (id, text, options) => {
      console.warn('[ExponentSpeech] Native TTS module not compiled into this build. Speech synthesis bypassed.');
      if (options && options.onDone) {
        setTimeout(options.onDone, 100);
      }
    },
    stop: async () => {},
    pause: async () => {},
    resume: async () => {},
    isSpeaking: async () => false,
    isSpeakingAsync: async () => false,
    getVoices: async () => [],
    getVoicesAsync: async () => [],
    addListener: () => ({ remove: () => {} }),
    removeListeners: () => {},
    removeAllListeners: () => {},
    listenerCount: () => 0,
  };
}
export default ExpoSpeech;
//# sourceMappingURL=ExponentSpeech.js.map
`,
  },
];

let applied = 0;
for (const shim of shims) {
  if (fs.existsSync(path.dirname(shim.path))) {
    fs.writeFileSync(shim.path, shim.content, 'utf-8');
    applied++;
  }
}

console.log(`[apply_native_shims] Successfully applied ${applied}/${shims.length} native module fallback shims.`);
