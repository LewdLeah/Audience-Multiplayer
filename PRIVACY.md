# Privacy Policy

**Audience Multiplayer** is a browser extension that connects livestream chat to AI Dungeon for collaborative storytelling.

## What This Extension Accesses

- **Public livestream chat messages:** Read to detect votes and action submissions
- **Twitch authentication:** Used to connect to your chat channel
- **AI Dungeon page content:** Read to detect available actions

## What Gets Stored

All data is stored **locally on your device** using Chrome's storage API:
- Your Twitch OAuth token
- Your OpenRouter API key (if provided)
- Extension settings and preferences

**I do not operate any servers. I do not collect, store, or have access to any of your data.**

## Third-Party Services

### Without an OpenRouter API Key

No data leaves your device. Votes are tallied locally and the winning action is submitted.

### With an OpenRouter API Key

When you provide your own API key, chat submissions (usernames and action text) are sent to [OpenRouter](https://openrouter.ai) to combine multiple suggestions into a single action. This uses **your API key** and **your OpenRouter account.** I never see this data. Review [OpenRouter's Privacy Policy](https://openrouter.ai/privacy) for how they handle requests.

## Questions

If you have questions, open an [issue](https://github.com/LewdLeah/Audience-Multiplayer).
