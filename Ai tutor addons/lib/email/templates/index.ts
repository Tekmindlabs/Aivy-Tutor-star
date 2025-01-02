export interface EmailTemplate {
  subject: string;
  html: string;
}

export function welcomeEmail(name: string): EmailTemplate {
  return {
    subject: 'Welcome to EmotiTutor AI',
    html: `
      <h1>Welcome to EmotiTutor AI, ${name}!</h1>
      <p>We're excited to have you on board. Start your learning journey today!</p>
    `
  };
}

export function shareNotificationEmail(
  sharedBy: string,
  contentTitle: string,
  contentType: string
): EmailTemplate {
  return {
    subject: `${sharedBy} shared ${contentType} with you`,
    html: `
      <h1>New Content Shared</h1>
      <p>${sharedBy} has shared "${contentTitle}" with you.</p>
      <p>Log in to view the shared content.</p>
    `
  };
}