import { resend } from './client';
import { EmailTemplate } from './templates';

export async function sendEmail({
  to,
  from = 'EmotiTutor AI <no-reply@your-domain.com>',
  template
}: {
  to: string;
  from?: string;
  template: EmailTemplate;
}) {
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: template.subject,
      html: template.html
    });

    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}