import { defineConfig } from 'astro/config';

// Project site on GitHub Pages: https://nambaf.github.io/gym-tracker-oss/
// `base` must match the repo name so internal links and assets resolve correctly.
// Switch to a custom domain later by setting `site` to it and removing `base`.
export default defineConfig({
  site: 'https://nambaf.github.io',
  base: '/gym-tracker-oss',
  trailingSlash: 'ignore',
  build: {
    assets: 'assets',
  },
});
