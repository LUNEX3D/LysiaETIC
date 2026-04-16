import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lysiaetic.app',
  appName: 'LysiaETIC',
  webDir: 'build',

  // ── Server Configuration ──
  // Development: Live reload from local dev server
  // Production: Uses bundled web assets from 'build' folder
  server: {
    // Uncomment for live reload during development:
    // url: 'http://192.168.1.X:3000',
    // cleartext: true,

    // Allow navigation to external URLs (API calls, OAuth)
    allowNavigation: [
      'lysiaetic.com',
      '*.lysiaetic.com',
      '*.hepsiburada.com',
      '*.trendyol.com',
      '*.n11.com',
      '*.ciceksepeti.com',
      'accounts.google.com'
    ],
    // Handle mixed content (HTTP API on HTTPS app)
    androidScheme: 'https',
    iosScheme: 'https'
  },

  // ── Android Configuration ──
  android: {
    // Allow HTTP traffic for local development
    allowMixedContent: true,
    // Splash screen background
    backgroundColor: '#0a0e1a',
    // Build options
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined
    },
    // WebView settings
    webContentsDebuggingEnabled: false // Set true for debug builds
  },

  // ── iOS Configuration ──
  ios: {
    // Content inset behavior for notched devices
    contentInset: 'automatic',
    // Background color
    backgroundColor: '#0a0e1a',
    // Scroll behavior
    scrollEnabled: true,
    // Allow inline media playback
    allowsLinkPreview: true,
    // Scheme
    scheme: 'LysiaETIC'
  },

  // ── Plugins Configuration ──
  plugins: {
    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0a0e1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerStyle: 'small',
      spinnerColor: '#0f766e',
      splashFullScreen: true,
      splashImmersive: true
    },

    // Status Bar
    StatusBar: {
      style: 'LIGHT', // Light text on dark background
      backgroundColor: '#0a0e1a',
      overlaysWebView: false
    },

    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },

    // Network
    Network: {
      // Auto-detect network changes
    },

    // Camera (for product photos)
    Camera: {
      // Default settings
    },

    // Filesystem (for invoice downloads, exports)
    Filesystem: {
      // Default settings
    }
  }
};

export default config;
