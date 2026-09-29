# dsh-plugin-harendra

[![CI](https://github.com/hChauhan4862/dsh-plugin-harendra/actions/workflows/ci.yml/badge.svg)](https://github.com/hChauhan4862/dsh-plugin-harendra/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-plugin-harendra.svg)](https://www.npmjs.com/package/dsh-plugin-harendra)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A personal [DSH Harness](https://github.com/deepseek-ai) Web UI plugin: everything I kept wanting
beside the composer and the sidebar — a focus timer, a water reminder, distinct alert sounds for the
events that actually need me, a tab favicon that shows what the agent is doing, and a DeepSeek
peak/off-peak rate badge.

One package, one client module, five features — each switchable from an **HC** button in the sidebar.

## Features

| Feature | Where it lives | What it does |
| --- | --- | --- |
| **Focus timer** | pill under the composer | 25/5/15-minute pomodoro with start, pause, reset, skip and a completed count |
| **Water reminder** | bottle in the sidebar foot | counts down a 45-minute interval, then asks whether you drank; accepts, snoozes or opens the card manually |
| **Sound alerts** | speaker in the sidebar foot | four distinct tones plus a mode menu (always / only when away / muted) |
| **Tab favicon** | the browser tab | the icon becomes a spinning arc while a run works, and changes when one needs an answer |
| **Pricing clock** | rate badge in the sidebar foot | shows whether DeepSeek is on peak or off-peak rates right now, with the conditions behind it |

All five can be switched off individually from the **HC** panel; switching one off stops its work
rather than merely hiding its button.

### The sounds

Four deliberately different tones, so you can tell what happened without looking:

| Event | Sound | Character |
| --- | --- | --- |
| Question / approval pending | high triangle trill, repeated **every 20 s** until answered | urgent |
| Run completed | soft low sine rise | final, unobtrusive |
| Run interrupted (you pressed Stop) | low triangle double thud | "that stopped" |
| Timer / water reminder | two mid sine blips | light |

Alerts honour the mode you pick: **always**, **only when the tab is not focused**, or **muted**.
Tones queue rather than overlap, so nothing clips and no limiter is needed.

### The pricing clock

Reads the published DeepSeek pricing schedule, showing the multiplier in force (for example `2×` on
peak, `1×` off-peak) and, on click, every condition behind it: peak windows converted to **your**
time zone, the weekday rule, the next change with a countdown, the next Chinese public holiday, and
which model's schedule you are following.

The schedule is fetched and cached for 12 hours, with a built-in offline copy, so the badge is
correct with no network at all. Data comes from
[apetersson/qnd](https://apetersson.github.io/qnd/deepseek-clock/pricing.json); the panel always shows
its provenance.

## Requirements

- A DSH Harness installation with the Web UI (`dsh web`).
- A Chromium-based browser. Sound requires one interaction per page load — a browser rule, not a
  plugin choice.

## Install

Published to npm as `dsh-plugin-harendra`, so install it by name:

```
plugin_manager(action: "install_bundle", target: "dsh-plugin-harendra")
```

Installing from a checkout works the same way — point `target` at the package directory instead. With
the Harness CLI you can also add the package to your profile by hand and restart. Either way the
bundle patch inserts a single row named `dsh-plugin-harendra`, and its Client half is served
automatically.

To remove it, `plugin_manager(action: "remove_bundle", target: "dsh-plugin-harendra")`.

## Updating

There is **no auto-update**, by design: the harness installs, removes, enables and disables bundles,
and resolves versions only at install time — it never polls for new releases. Updating is one
command, re-run after a new version is published:

```
plugin_manager(action: "install_bundle", target: "dsh-plugin-harendra")
```

pnpm re-resolves the range and picks up the newest published version. A `link:` install (a checkout
on disk) needs no update at all, since the profile reads the live directory.

If you granted a version exemption for an incompatible release, note that exemptions are recorded per
exact `package@version` and do not carry over to the next one.

## Usage

- **Composer pill** — start, pause, reset or skip the focus timer.
- **Sidebar foot** — `HC` opens the feature switches; the bottle, speaker and rate badge each open
  their own panel on click.
- **Panels** — close on selection, on `Escape`, or on a click outside.

Preferences are stored in the page's `localStorage`:

| Key | Holds |
| --- | --- |
| `dsh.harendra.features.v1` | which features are on |
| `dsh.sound.state.v1` | alert mode (always / away / off) |
| `dsh.pomodoro.state.v1` | timer state |
| `dsh.water.state.v1` | reminder state |
| `dsh.peak.data.v1`, `dsh.peak.selected.v1` | cached schedule and chosen model |

## How it is built

A single Client module (`client.js`) registered through `window.__ModuleLoader__`, with no build step
and no imports from other Harness Client packages. It extends the Web UI through slots:

| Slot | Entry |
| --- | --- |
| `conversation.composer.dock` | focus timer pill |
| `sidebar.footer.action` | `HC`, water bottle, speaker, rate badge |
| `shell.overlay` | settings panel, water card, sound menu, pricing panel, and two renderless watchers |

Styling uses only `--dsw-alias-*` theme tokens, so it follows light and dark themes. Every timer,
listener and subscription is registered with `ctx.effect` and cleaned up on unload.

## Notes and limitations

- An interruption is detected from the conversation's own `interrupted` status, so it is only noticed
  while that session's chat is open — which is exactly when you can press Stop.
- The pricing schedule is third-party data; the plugin shows where it came from rather than
  presenting it as authoritative.
- The focus timer and water reminder are conveniences, not medical or productivity advice.

## Releasing

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Tag the release and push the tag:

```
git tag v3.0.1
git push origin v3.0.1
```

The `Publish to npm` workflow refuses a tag that disagrees with `package.json`, validates the
package, and then publishes it with a provenance attestation. It reads an npm automation token from
the repository secret `NPM_TOKEN` (Settings → Secrets and variables → Actions).

To use npm's trusted publishing instead of a long-lived token, add this repository and the
`publish.yml` workflow as a trusted publisher on npmjs.com, then drop the `NODE_AUTH_TOKEN` wiring
and the token guard from the workflow.

`CI` runs on every push and pull request and checks the syntax, the manifests, the bundle wiring and
locale parity — so a broken client module fails before it can be published.

## License

MIT — see [LICENSE](LICENSE).
