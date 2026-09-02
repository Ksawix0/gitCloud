// @ts-check
import {defineConfig, fontProviders} from 'astro/config';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  fonts: [{
    provider: fontProviders.google(),
    name: 'Oxanium',
    cssVariable: "--font-oxanium",
  }],

  integrations: [preact()]
});