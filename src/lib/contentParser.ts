// Parse mentions (@username) and hashtags (#tag) from post content

export interface ParsedContent {
  type: 'text' | 'mention' | 'hashtag';
  content: string;
  userId?: string; // for mentions
}

export const parsePostContent = (content: string): ParsedContent[] => {
  const parts: ParsedContent[] = [];
  const regex = /(@\w+)|(#\w+)|([^@#]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      // Mention
      parts.push({
        type: 'mention',
        content: match[1],
      });
    } else if (match[2]) {
      // Hashtag
      parts.push({
        type: 'hashtag',
        content: match[2],
      });
    } else if (match[3] && match[3].trim()) {
      // Regular text
      parts.push({
        type: 'text',
        content: match[3],
      });
    }
  }

  return parts;
};

export const extractMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]); // username without @
  }

  return mentions;
};

export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;

  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1]); // hashtag without #
  }

  return hashtags;
};
