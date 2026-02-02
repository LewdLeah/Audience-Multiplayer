<p align="center">
  <img src="extension/icons/icon128.png" width="128">
</p>

# Audience Multiplayer
Made by LewdLeah ❤️

---

## What Is This?

Audience Multiplayer is a browser extension that connects your **Twitch** and/or **YouTube Live** chat to **AI Dungeon**, allowing your viewers to submit actions and vote on what happens next in your adventure.

**How it works:**
1. Your viewers submit actions in chat (e.g., `> investigate the noise`)
2. They vote for their favorite submissions (`+1 @username`)
3. The extension combines the top submissions (using AI if configured) into a single action
4. The combined action is automatically submitted to your AI Dungeon adventure

This creates an interactive multiplayer experience where your audience actively participates in your story!

---

## Requirements

Before you begin, make sure you have:

- **Google Chrome** or **Microsoft Edge** browser
- An **AI Dungeon** account ([create one here](https://aidungeon.com/))
- (Optional) A **Twitch** account (for Twitch chat integration)
- (Optional) A **YouTube** account with an active livestream (for YouTube chat integration)
- (Optional) An **OpenRouter** API key (for AI-powered action blending)

---

## Installation Guide

### Step 1: Download the Extension

1. Click the green **Code** button on this GitHub page
2. Click **Download ZIP**
3. Find the downloaded file (usually in your Downloads folder)
4. Right-click the ZIP file and select **Extract All...**
5. Choose a location you'll remember (like your Desktop)
6. Click **Extract**

You should now have a folder called `Audience-Multiplayer-main` (or similar).

### Step 2: Open Chrome Extension Settings

1. Open **Google Chrome** (or Microsoft Edge)
2. In the address bar, type: `chrome://extensions`
3. Press **Enter**
4. In the top-right corner, find the toggle labeled **Developer mode**
5. Click the toggle to turn it **ON** (it should turn blue)

### Step 3: Load the Extension

1. Click the **Load unpacked** button (appears after enabling Developer mode)
2. Navigate to the folder you extracted in Step 1
3. Open the folder until you see a subfolder called `extension`
4. Select the `extension` folder
5. Click **Select Folder**

You should now see "Audience Multiplayer" in your extensions list!

### Step 4: Pin the Extension (Recommended)

1. Click the puzzle piece icon in your browser toolbar (top-right)
2. Find "Audience Multiplayer" in the list
3. Click the pin icon next to it

The extension icon will now appear in your toolbar for easy access.

---

## Initial Setup

### Connect to AI Dungeon

1. Open **AI Dungeon** in a new tab: https://play.aidungeon.com
2. Log in to your account if needed
3. Start or continue an adventure
4. The extension will automatically detect AI Dungeon and connect
5. Check the extension popup - the "AID" status dot should turn **green**

**Note:** The extension detects when you're in an adventure by reading the URL. Make sure you're on an adventure page (not the homepage).

### (Optional) Connect to Twitch

1. Click the **Audience Multiplayer** icon in your toolbar
2. Scroll down to find the **Twitch Channel** field
3. Enter your Twitch channel name (e.g., `LewdLeah`)
4. Click the **Connect Twitch** button
5. A Twitch login window will appear - log in and authorize the app
6. You should see "✓ Connected" next to the button

### (Optional) Connect to YouTube Live

1. In the extension popup, find the **YouTube URL** field
2. Paste your YouTube livestream URL (e.g., `https://www.youtube.com/live/ABC123`)
3. Open your YouTube livestream in a separate browser tab
4. Make sure the **Live Chat** panel is visible (popout chat also works)
5. The "YT" status dot should turn **green**

**Note:** You must keep the YouTube tab open for chat to work.

### (Optional) Set Up OpenRouter API

Without an OpenRouter API key, the extension will use a simple voting system where the submission with the most votes wins.

With an API key, the extension can **blend multiple submissions** into one coherent action using AI.

1. Go to https://openrouter.ai/ and create an account
2. Navigate to https://openrouter.ai/settings/keys
3. Click **Create Key** and copy the key
4. In the extension popup, paste the key in the **OpenRouter API Key** field
5. Select your preferred AI model from the dropdown

---

## How to Use

### Starting a Voting Session

**Option A: Manual Start**
1. Click the **Start Vote** button in the extension popup
2. The extension announces in Twitch chat that voting has started

**Option B: Chat Command (Mods/Broadcaster only)**
- Type `!vote` in your Twitch chat

### During Voting

**Submitting Actions:**
- Viewers type their action starting with `>` (greater-than symbol)
- Example: `> open the mysterious door`
- Example: `>search the room for clues`

**Voting for Submissions:**
- Viewers vote by typing `+1 @username`
- Example: `+1 @CoolViewer123`
- Alternative format: `@username +1`

**Each viewer can:**
- Submit one action (or update their submission by sending a new one)
- Vote for one other person's submission

### Ending Voting

**Option A: Automatic**
- Voting ends when the timer runs out (default: 40 seconds)

**Option B: Manual End**
- Click the **End Vote** button in the popup

**Option C: Chat Command (Mods/Broadcaster only)**
- Type `!tally` in your Twitch chat

### What Happens Next

1. If you have an OpenRouter API key:
   - The AI blends all submissions into one action
   - The combined action is submitted to AI Dungeon

2. If you don't have an API key:
   - The submission with the most votes wins
   - That exact submission is sent to AI Dungeon

---

## Settings Explained

| Setting | Description |
|:--------|:------------|
| **Twitch Channel** | Your Twitch channel name (optional) |
| **YouTube URL** | Full URL to your YouTube livestream (optional) |
| **Player Character Name** | Your character's name in the adventure |
| **Party Member Name** | The name used when submitting chat actions to AID |
| **OpenRouter API Key** | Your OpenRouter key for AI action blending (optional) |
| **Model** | Which AI model to use for blending (optional) |
| **Vote Duration** | How long each voting session lasts (seconds) |
| **Auto-Repeat** | Automatically start new votes (optional) |
| **Debug Mode** | Allows duplicate votes/submissions (testing) |

---

## Auto-Repeat Mode

Want continuous voting without manually clicking buttons?

1. Set **Auto-Repeat** to a number (seconds)
2. After each vote ends and the action is submitted, a new vote automatically starts
3. Use the **Pause** button (⏸) to temporarily stop auto-repeat
4. Use the **Resume** button (▶) to continue

Example: Setting Auto-Repeat to 60 means a new vote starts 60 seconds after each vote ends.

---

## Troubleshooting

### The AI Dungeon status dot is red

- Make sure you're logged into AI Dungeon
- Make sure you're on an **adventure page** (not the home screen)
- Try refreshing the AI Dungeon tab
- Prod (play), Beta, and Alpha only

### The Twitch status dot is red

- Make sure you've entered your channel name correctly
- Try clicking "Disconnect" then "Connect Twitch" again
- Check that you authorized the app in the Twitch popup

### YouTube chat isn't working

- Make sure you entered the full YouTube URL in settings
- The YouTube tab must stay open (don't close it)
- The Live Chat panel must be visible
- YouTube's DOM structure may have changed - check for extension updates

### Submissions aren't being detected

- Viewers must start their message with `>` (greater-than symbol)
- Make sure voting is active (phase shows "vote" in the popup)

### Votes aren't counting

- The format must be exactly `+1 @username` or `@username +1`
- Chatters cannot vote for themselves
- Chatters can only vote once per other chatter per voting session (unless Debug Mode is on)
- Note: votes don't do anything if an OpenRouter API key was provided

---

## Chat Commands Reference

| Command | Who Can Use | What It Does |
|:--------|:------------|:-------------|
| `!vote` | Twitch: Broadcaster/Mods | Starts a new voting session |
| `!tally` | Twitch: Broadcaster/Mods | Ends voting early and tallies results |
| `> action` | Twitch/YouTube: Everyone | Submits an action during voting |
| `+1 @user` | Twitch/YouTube: Everyone | Votes for someone's submission |

---

## Useful Links

- [AI Dungeon](https://aidungeon.com/) - The game this extension integrates with
- [AI Dungeon Discord](https://discord.gg/MXNqpSbuZT) - Community discussion

---

<p align="center"><i>Have fun playing with your audience~</i></p>
<p align="center"><b>Audience Multiplayer v1.0.0</b> · Made with love by <a href="https://play.aidungeon.com/profile/LewdLeah">LewdLeah</a> ❤️</p>
