// Detect if the app is running inside Arena App Store
export const isArenaApp = (): boolean => {
  try {
    // If we're inside any iframe, treat it as Arena container
    if (window.self !== window.top) {
      return true;
    }
    return false;
  } catch (e) {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true;
  }
};
