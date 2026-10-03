import {
  getGmailClient,
  getUnreadEmails,
  createDraft,
  generateAndSaveEmailSummaries,
} from './gmail';
import { generateReply } from './agent';

(async () => {
  try {
    const gmail = await getGmailClient();
    const emails = await getUnreadEmails(gmail);

    // Save email summaries to a CSV file when unread emails exist.
    if (emails.length > 0) {
      console.log('Creating email summaries CSV...');
      const csvPath = await generateAndSaveEmailSummaries(emails);
      console.log(`Email summaries saved to: ${csvPath}`);
    } else {
      console.log('No unread emails found.');
    }

    // Create a draft reply for each unread email.
    for (const email of emails) {
      console.log(`\nNew email from ${email.from}`);
      const replyText = await generateReply(email.body);
      console.log(`Draft reply:\n${replyText}\n`);
      await createDraft(gmail, email.from, email.subject, replyText);
    }

    console.log('All drafts created in your Gmail Drafts folder.');
  } catch (error) {
    console.error('Error in email workflow:', error);
  }
})();
