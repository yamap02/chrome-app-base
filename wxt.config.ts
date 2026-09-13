import { defineConfig } from "wxt";
import { EXTENSION_METADATA } from "./utils/metadata";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: EXTENSION_METADATA.name,
    short_name: EXTENSION_METADATA.shortName,
    description: EXTENSION_METADATA.description,
    permissions: ["storage"],
    action: {
      default_title: EXTENSION_METADATA.popupTitle,
    },
  },
  webExt: {
    startUrls: [...EXTENSION_METADATA.startUrls],
  },
});
