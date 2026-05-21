// DEPRECATED: adapter is intentionally disabled because the target site flow is obsolete.
export default {
  name: '600tools',
  deprecated: true,
  async submit() {
    throw new Error('DEPRECATED adapter: 600tools is no longer supported.');
  },
};
