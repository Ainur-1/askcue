# Changelog

## Unreleased

### Project

- Adopt the MIT License for AskCue, retaining attribution to the original project and its contributors. Third-party components retain their own licenses.

## 0.0.1 (2026-11-13)

Initial AskCue fork baseline. This entry describes the source version; packaged release availability is listed on GitHub Releases.

### Features

- AskCue branding, updated desktop workspace, light and dark themes, and English/Russian interface localization.
- Official OpenCode SDK integration with provider discovery, model search and selection, and streamed responses.
- AI action diagnostics and clearer handling of provider failures.
- Response timing with elapsed time and time to first text.
- Windows startup, window sizing, system proxy routing, and meeting history search improvements.

### Project

- Start independent AskCue versioning at `0.0.1`.
- Rewrite the README around verified capabilities, setup instructions, and data handling.
- Align repository metadata and the package license field with this fork and its existing license.

## Upstream history

The entries below are retained from the original project and use its version numbering.

## [2.3.0](https://github.com/royisme/pikabaka/compare/v2.2.0...v2.3.0) (2026-07-14)


### Features

* **transcript:** second-pass correction - reopen & merge flushed turns ([#17](https://github.com/royisme/pikabaka/issues/17)) ([7b48e22](https://github.com/royisme/pikabaka/commit/7b48e221bdc6fe7aa4b60cf6b94eea0fb97dbb21))

## [2.2.0](https://github.com/royisme/pikabaka/compare/v2.1.0...v2.2.0) (2026-05-06)


### Features

* **settings:** add Auto (multi-language) STT option, gate Azure/IBM ([#6](https://github.com/royisme/pikabaka/issues/6)) ([#12](https://github.com/royisme/pikabaka/issues/12)) ([5369ec3](https://github.com/royisme/pikabaka/commit/5369ec311b4a94907994ca548627f29d81e42c24))
* **stt:** Deepgram multi-language auto-detect ([#2](https://github.com/royisme/pikabaka/issues/2)) ([#9](https://github.com/royisme/pikabaka/issues/9)) ([aef38c5](https://github.com/royisme/pikabaka/commit/aef38c57a71bdff14cb9c5f969e46f7e57f0bd5c))
* **stt:** Google alternativeLanguageCodes for auto ([#3](https://github.com/royisme/pikabaka/issues/3)) ([#8](https://github.com/royisme/pikabaka/issues/8)) ([745a65c](https://github.com/royisme/pikabaka/commit/745a65c44653e5e9f9b8bfba7323ed2df4ec39bd))
* **stt:** OpenAI/Groq Whisper auto-detect language ([#4](https://github.com/royisme/pikabaka/issues/4)) ([#11](https://github.com/royisme/pikabaka/issues/11)) ([b9ed1ab](https://github.com/royisme/pikabaka/commit/b9ed1abb6cc2200bfb8f78d6c91817a626b1d3c3))
* **stt:** Soniox emit detectedLanguage ([#5](https://github.com/royisme/pikabaka/issues/5)) ([#10](https://github.com/royisme/pikabaka/issues/10)) ([02fa893](https://github.com/royisme/pikabaka/commit/02fa8930eee2e5d16d5297e8fbd4896fa3574b4a))
* **transcript:** per-segment language badge + translation copy update ([#7](https://github.com/royisme/pikabaka/issues/7)) ([#13](https://github.com/royisme/pikabaka/issues/13)) ([43bd978](https://github.com/royisme/pikabaka/commit/43bd9787abd3cb1d33d4496535666c1c6e7dcf05))
* **translation:** target-language-only translation + detectedLanguage plumbing ([6cf0037](https://github.com/royisme/pikabaka/commit/6cf0037df9119f626cf0135fa78aea7ac675a5dd))


### Bug Fixes

* **ci:** use pnpm in build-smoke workflow ([#14](https://github.com/royisme/pikabaka/issues/14)) ([bacaae9](https://github.com/royisme/pikabaka/commit/bacaae9e8e59b5600f0d253c853b38a9bdb753c0))


### Build & Release

* add scripts/release.js for one-shot release publishing ([3318e4b](https://github.com/royisme/pikabaka/commit/3318e4b5c9031e2fb105029e760d22fdc7bb0f96))


### Refactoring

* add launcher history components ([88f301a](https://github.com/royisme/pikabaka/commit/88f301ab680832f1e56e74cd772264ed9adf483f))
* modernize launcher and meeting UI ([a43effc](https://github.com/royisme/pikabaka/commit/a43effc2989161fcefc7579f3ef00f6f9a46c2a7))
