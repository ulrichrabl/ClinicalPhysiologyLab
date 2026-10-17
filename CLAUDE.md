# For agents working in this repository

Start with `docs/HANDOVER.md`. It covers how to build and check the project, the rules agreed with the owner, what is done, the open lists and the next topic.

If you will change the bedside patient figure, also read `source/studio/figure/BRIEF.md`.

The essentials:

- **Commands:** run them from `source/`. `npm run verify` must pass before a PR.
- **Before committing:** run `git checkout -- source/node_modules source/dist`. Both are vendored, and the build touches them; commit source files only.
- **Branches:** branch from a freshly pulled `main`, one PR per topic. The owner merges; merging to `main` deploys the app to GitHub Pages.
- **Commit messages:** end with the session's `Co-Authored-By` and `Claude-Session` lines.
- **PR bodies:** end with the Claude Code line and the session link.
- **Languages:** every learner-facing text is in English and German.
- **Evidence:** ground the model in human data. Report a mismatch as a known gap; never tune a constant to make an expected answer come out.
- **Visual work:** show the owner pictures, with close-ups for anatomy, before claiming a fix.
