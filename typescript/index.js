// `matimo` is the umbrella package. It re-exports @matimo/core rather than bundling a
// second copy, so module-level state (the global instance, approval handler, logger)
// is shared with the provider tools and meta-tools, which import @matimo/core directly.
export * from '@matimo/core';
