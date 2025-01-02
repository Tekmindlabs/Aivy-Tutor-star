import { URL } from './types';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from './embeddings';

export async function processURL(
  url: string,
  userId: string
): Promise<URL> {
  const response = await fetch(url);
  const html = await response.text();
  
  // Extract main content (simplified)
  const content = extractContent(html);
  const title = extractTitle(html);
  
  const embedding = await getEmbedding(content);

  const urlDoc = await prisma.urls.create({
    data: {
      userId,
      url,
      title,
      content,
    },
  });

  await prisma.vectors.create({
    data: {
      contentType: 'url',
      contentId: urlDoc.id,
      embedding,
    },
  });

  return urlDoc;
}

function extractContent(html: string): string {
  // Simplified content extraction
  // In production, use a proper HTML parser
  return html.replace(/<[^>]*>/g, ' ').trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.*?)<\/title>/);
  return match ? match[1] : '';
}