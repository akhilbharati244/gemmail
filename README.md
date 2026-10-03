# gemmail

**Author:** Akhil Bharati

A Node.js and TypeScript CLI agent that uses the Gmail API and Google Gemini (`gemini-3.8-flash`) to summarize unread emails and create draft replies.

## Setup Instructions

### 1. Clone the Repository

```sh
git clone https://github.com/akhilbharati244/gemmail.git
cd gemmail
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

Set your Gemini API key in the `.env` file:

```env
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-3.8-flash"
GMAIL_SCOPES="https://www.googleapis.com/auth/gmail.modify"
```

### 4. Set Up Gmail API Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing project.
3. Enable the Gmail API for your project.
4. Create OAuth 2.0 credentials for a Desktop client.
5. Download the JSON file, rename it to `client.json`, and place it in the project root directory.

### 5. Run the Project

```sh
npm run dev
```

On the first run:

1. The terminal prints an authorization URL.
2. Open the URL in your browser and sign in to your Gmail account.
3. Copy the `code` parameter from the redirect URL and paste it into the terminal prompt.
4. The tool saves a `token.json` file for future runs.

## Output

- **Summaries:** The tool writes a CSV summary file to `./csv/email-summaries-<timestamp>.csv`.
- **Drafts:** The tool creates a separate reply draft for each unread email in your Gmail Drafts folder.

## Security

Never commit sensitive credentials or tokens to GitHub.

Make sure the following files are included in your `.gitignore`:

```gitignore
.env
client.json
token.json
```
