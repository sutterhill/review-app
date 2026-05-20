import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  makers: [new MakerSquirrel({}), new MakerZIP({}, ["darwin"]), new MakerRpm({}), new MakerDeb({})],
  packagerConfig: {
    asar: true,
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          config: "vite.main.config.ts",
          entry: "src/main/main.ts",
        },
        {
          config: "vite.preload.config.ts",
          entry: "src/preload/preload.ts",
        },
      ],
      renderer: [
        {
          config: "vite.renderer.config.ts",
          name: "main_window",
        },
      ],
    }),
  ],
  rebuildConfig: {},
};

export default config;
