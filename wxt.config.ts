import { defineConfig } from "wxt";

const EXTENSION_NAME = "Chrome Extension Base";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: EXTENSION_NAME,
    short_name: "Ext Base",
    description: "WXT + React + TypeScript based Chrome extension template",
    permissions: ["storage"],
    action: {
      default_title: EXTENSION_NAME,
    },
  },
  webExt: {
    startUrls: ["https://example.com"],
  },
});
