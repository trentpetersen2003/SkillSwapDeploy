const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    allowCypressEnv: false,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
