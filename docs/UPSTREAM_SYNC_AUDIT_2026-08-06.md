# NextChat Managed Web Sync Audit — 2026-08-06

## Scope

This audit covers only `tqytwe/NextChat` Managed Web. It does not authorize or
require changes to `tqytwe/sub2api`, the independently developed Android client,
Capacitor, APK artifacts, or native mobile release workflows.

## Immutable references

| Role | Repository / branch | Commit |
|---|---|---|
| Official upstream | `ChatGPTNextWeb/NextChat:main` | `706a18b95b714ab29b2a4842d3b9ff4f887935d5` |
| Official version description | nearest tag plus commits | `v2.16.1-54-g706a18b` |
| Fork branch merge-base | `tqytwe/main` and Managed Web | `1d66fd9770e04e651aab495b987e12c2db2b7ea3` |
| Managed Web production baseline | `feat/sub2api-managed-20260720` | `ab26d0bb39c81f2ae11d68f78181393f2f7d9124` |
| Fork `main` audit tip | `tqytwe/NextChat:main` | `fb48a03009075e1b20ae6a9c9dbb580c471338d7` |

The pristine parent of the first Managed-mode commit is exactly the current
official upstream `main`. Official upstream therefore has **zero commits** after
our baseline as of this audit. The apparent `main` divergence is internal fork
work, not official NextChat releases.

## Full classification of 87 fork-main-only commits

Every commit in `1d66fd9..fb48a03` was reviewed. Categories below account for
all 87 graph-unique commits, including merge commits.

### Managed-mode sibling implementation — skip (1)

- `e58e80e` — alternate initial Sub2API Managed implementation. It is a sibling
  of the production Managed line and is superseded by the more complete
  `feat/sub2api-managed-20260720` history. Do not cherry-pick or merge it.

### Android / native mobile / APK / Capacitor — out of scope (80)

The following commits belong to the independently developed Android/mobile
product line or its merges/releases. They are not Managed Web upstream updates:

```text
583946d 3875099 10de2d6 ba6d31d bd63b38 23bc40d 5ecc13a d174637
4df6f41 b60c595 2e32a06 8e7ca46 7d09225 0faa4cd 2c1b1d8 2287a05
4c1dcb3 97d82d6 14df782 e02af16 7bc895c f1fd5ff ba8f74c fd35040
7e180c8 ca29fa5 08a15ee 770b901 7a30cf5 ade04ad 018fbf5 bdc61cb
4c0d60b 3eca290 0001df0 344a443 96d3612 7530184 c4f84c4 e1abd83
d0d9a0e 4bca301 3333c83 1645eef 540cb4e 3cbd31a 13dbb7f d9bdfed
102cc6a bf740f4 b508c5b 67f8353 24ba013 ae5754a 7a6288a dfeec57
108b671 b97874f 1b03535 8d30e9d f32d65a 4e95b7d 1d94ed0 b56e98e
ec62964 3f6ef4a 405a7f3 c2a93ac 8cc57e4 370a1d8 5454aa4 1f4f8ef
04b25e7 d391290 e5a577a 215e270 1daf57d a8817a3 614b3ed 7334180
89651ca bd863e5 eaddacb
```

Some subjects omit `android`, but their changed files are mobile-only or depend
on Android/mobile APIs. `97d82d6` changes CI for the Android line and is not a
standalone Managed Web feature. `e02af16` and `7bc895c` target mobile growth and
welfare UI backed by Sub2API APIs, so they are excluded both by Android scope
and the prohibition on changing/expanding Sub2API contracts in this project.

### General Web/build fixes — already migrated (3)

| Fork `main` | Managed Web equivalent | Decision |
|---|---|---|
| `ea9200c` preserve uploaded images | `409db9a` | migrated with Managed chat behavior preserved |
| `563d64c` Node 20 base image | `04ee72f` | patch-equivalent and migrated |
| `fb48a03` stable npm registry | `bd12b4c` | migrated while preserving Managed lockfile dependencies |

Managed governance evidence was added in `3cede64` and `ab26d0b`. GitHub Actions
run `31085530064` passed dependency install, design governance, Jest, and the
Managed production build. No local install, test, typecheck, or build was used.

### Remaining applicable candidates — none (0)

After excluding the sibling implementation and Android/mobile line, the only
platform-neutral candidates were the three fixes above, and all three are
already present on the Managed Web production branch.

## Sync conclusion

As of 2026-08-06:

1. Official upstream has no commits after our exact official baseline.
2. Fork `main` contains no additional unported Managed Web candidates.
3. Managed Web is synchronized for all applicable Web/build fixes without
   importing Android or requiring `subapi` changes.
4. Future syncs must compare from the recorded official upstream SHA, not infer
   updates from `tqytwe/main` ahead/behind counts.

## Evidence commands

```bash
git merge-base tqytwe/main tqytwe/feat/sub2api-managed-20260720
git show 1d66fd9770e04e651aab495b987e12c2db2b7ea3^
git describe --tags --long 706a18b95b714ab29b2a4842d3b9ff4f887935d5
git rev-list --count 706a18b95b714ab29b2a4842d3b9ff4f887935d5..official/main
git log --reverse 1d66fd9..fb48a03
```

Expected official delta for this audit: `0`.
