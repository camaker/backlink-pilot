// DEPRECATED: adapter is intentionally disabled because the target site flow is obsolete.
export default {
  name: 'dangai',
  deprecated: true,
  async submit() {
    throw new Error('DEPRECATED adapter: dangai is no longer supported.');
  },
};
