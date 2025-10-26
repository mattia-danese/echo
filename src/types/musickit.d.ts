declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: external global from Apple MusicKit
    MusicKit: any;
  }

  // Global MusicKit provided by Apple MusicKit JS
  // biome-ignore lint/suspicious/noExplicitAny: external global from Apple MusicKit
  const MusicKit: any;
}

export {};
