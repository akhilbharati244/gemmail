import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google, gmail_v1 } from 'googleapis';
import { createObjectCsvWriter } from 'csv-writer';
import { generateSummary } from './agent';

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const rawScope =
  process.env.GMAIL_SCOPES ||
  process.env.SCOPE_URL ||
  process.env.SCOPES_URL ||
  DEFAULT_SCOPE;
const SCOPES = [rawScope.replace(/"/g, '').trim()];
const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../client.json');

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
}

async function promptForAuthCode(
  oAuth2Client: InstanceType<typeof google.auth.OAuth2>,
) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app at this URL:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) =>
    rl.question('Enter the authorization code: ', (input) => {
      rl.close();
      resolve(input.trim());
    }),
  );

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('client.json was not found in the project root directory.');
  }

  const credentialsFile = JSON.parse(
    fs.readFileSync(CREDENTIALS_PATH, 'utf-8'),
  );
  const credentials = credentialsFile.installed || credentialsFile.web;

  if (!credentials) {
    throw new Error(
      'Invalid client.json format: expected an "installed" or "web" property.',
    );
  }

  const { client_secret, client_id, redirect_uris } = credentials;
  const redirectUri =
    redirect_uris && redirect_uris.length > 0
      ? redirect_uris[0]
      : 'http://localhost';

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri,
  );

  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = fs.readFileSync(TOKEN_PATH, 'utf-8').trim();

      if (!tokenData) {
        throw new Error('Token file is empty.');
      }

      oAuth2Client.setCredentials(JSON.parse(tokenData));
    } else {
      await promptForAuthCode(oAuth2Client);
    }
  } catch (error) {
    console.warn(
      'Saved token is not valid. Requesting a new authorization code.',
    );
    await promptForAuthCode(oAuth2Client);
  }

  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

function extractEmailBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) {
    return '';
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts && payload.parts.length > 0) {
    const plainPart = payload.parts.find(
      (part) => part.mimeType === 'text/plain',
    );

    if (plainPart) {
      const text = extractEmailBody(plainPart);
      if (text) {
        return text;
      }
    }

    for (const part of payload.parts) {
      const text = extractEmailBody(part);
      if (text) {
        return text;
      }
    }
  }

  return '';
}

export async function getUnreadEmails(
  gmail: gmail_v1.Gmail,
): Promise<EmailMessage[]> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX', 'UNREAD'],
    maxResults: 10,
  });

  const messages = res.data.messages || [];
  const excludedLabels = [
    'CATEGORY_SOCIAL',
    'CATEGORY_PROMOTIONS',
    'CATEGORY_UPDATES',
    'SPAM',
  ];

  const filteredResults: EmailMessage[] = [];

  for (const msg of messages) {
    if (!msg.id) {
      continue;
    }

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    });

    const messageLabels = full.data.labelIds || [];
    const hasExcludedLabel = messageLabels.some((label) =>
      excludedLabels.includes(label),
    );

    if (!hasExcludedLabel) {
      const payload = full.data.payload;
      const headers = payload?.headers || [];
      const from =
        headers.find((h) => h.name === 'From')?.value || '';
      const subject =
        headers.find((h) => h.name === 'Subject')?.value || '';
      const body = extractEmailBody(payload);

      filteredResults.push({
        id: msg.id,
        from,
        subject,
        body,
      });
    }
  }

  return filteredResults.slice(0, 3);
}

export async function generateAndSaveEmailSummaries(
  emails: EmailMessage[],
): Promise<string> {
  const csvDir = path.join(__dirname, '../csv');

  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvFilePath = path.join(
    csvDir,
    `email-summaries-${timestamp}.csv`,
  );

  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'from', title: 'From' },
      { id: 'subject', title: 'Subject' },
      { id: 'summary', title: 'Summary' },
    ],
  });

  const records = [];

  for (const email of emails) {
    const summary = await generateSummary(email.body);

    records.push({
      id: email.id,
      from: email.from,
      subject: email.subject,
      summary,
    });
  }

  await csvWriter.writeRecords(records);
  return csvFilePath;
}

export async function createDraft(
  gmail: gmail_v1.Gmail,
  to: string,
  subject: string,
  messageText: string,
): Promise<void> {
  const replySubject = subject.startsWith('Re:')
    ? subject
    : `Re: ${subject}`;

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${replySubject}\r\n\r\n${messageText}`,
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });

  console.log(`Draft created for: ${to}`);
}
