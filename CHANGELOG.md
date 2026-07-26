# Changelog

## 1.3.1 - Home Screen Polish

- Replaced the generated placeholder icons with the custom Fit Roulette artwork.
- Added dedicated 180x180 Apple touch, 192x192 PWA, 512x512 PWA, and 32x32 favicon PNG assets.
- Audited standalone iPhone installation metadata and GitHub Pages-safe relative paths.
- Declared install icons with `purpose: "any"` and removed the stale maskable declaration.
- Synchronized the service-worker cache name with app version `1.3.1`.

App release versions are independent from the local user-data schema. This release continues to use the unchanged `fitRoulette.v1` localStorage key and does not migrate or reset saved data.
