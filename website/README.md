# AskCue landing page

A dependency-free, bilingual (Russian / English) static landing page for AskCue.

## Preview locally

From the repository root:

    python -m http.server 4173 --bind 127.0.0.1 --directory website

Open http://127.0.0.1:4173/ in a browser. You can also open index.html directly; clipboard access may fall back to selecting the commands when the browser does not allow it.

## Check

    node --check website/app.js
    node website/check.mjs

The check verifies local assets, anchors, translation coverage, application version, license, and basic demo metadata. Browser QA should cover both languages, all three demo actions, command copying, FAQ expansion, keyboard navigation, and narrow screens.

The illustrated meeting uses fictional content and example timing. It does not access the microphone, make AI requests, or upload data. The language preference is stored in browser localStorage when available. No external fonts, trackers, or runtime dependencies are loaded.

## GitHub Pages

The workflow at ../.github/workflows/website.yml checks pull requests and deploys only from main.

Before the first production deployment, configure the repository once:

1. Open the AskCue repository on GitHub.
2. Go to Settings → Pages.
3. Select GitHub Actions as the build and deployment source.
4. Merge the reviewed landing-page PR into main.

The workflow publishes only website/, not the Electron application or the repository root. The expected project URL is https://ainur-1.github.io/askcue/. Relative asset URLs support this subdirectory.

Do not merge or change Pages settings solely to preview a design. Review the branch and local page first.

## Content maintenance

- Update index.html for the default Russian copy.
- Keep the matching English strings in app.js.
- Update the displayed version when package.json changes.
- Download links point to the fork's Releases listing, so they do not imply an installer exists.
- Keep provider costs, data handling, and platform support aligned with the application README.
- The logo is shared with the app; its third-party notice is retained in assets/ICON-LICENSE.txt.
