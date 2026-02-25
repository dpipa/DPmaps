# DPmaps
DPmaps is designed to help track and manage planned road and utility works.

## Features
- Layer toggles: Cadastre, Contours, and Stormwater (read-only).
- Drawing & Edit tools: Roadworks and Utilities (changes are **not saved automatically**). They will be lost on page refresh.
- Search: Find addresses or Job IDs using the search bar. Results for address may not return exact house property due to Leaflet/Nominatim limitations.
- Export: Export data to Excel for easier job tracking.
- Quick view: Right-click on a cadastre parcel (desktop) or long-press (mobile) to open Google Street View.

## Technical Details
- Built with [Leaflet](https://leafletjs.com/)
- Geospatial data uses WGS 84 coordinate system (EPSG:4326)
- Cadastre and Contour layers are loaded as a Release (instead of Repository) via Cloudflare due to Github's file size limit.
These layers may lag when loaded.
- Stormwater data uses smaller, clickable markers with invisible hit areas for easier mobile interaction

## License
© 2026 Dean P. All rights reserved.
Do not copy or reuse without permission.
