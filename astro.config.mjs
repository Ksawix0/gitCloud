// @ts-check
import {defineConfig, fontProviders} from 'astro/config';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
    fonts: [{
      provider: fontProviders.google(),
      name: 'Rubik',
      cssVariable: "--font-rubik"
    }],
    integrations: [preact()],

    site: 'https://ksawix0.github.io/',
    base: '/gitCloud',
});