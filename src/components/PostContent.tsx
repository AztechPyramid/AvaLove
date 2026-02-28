import { parsePostContent, ParsedContent } from '@/lib/contentParser';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface PostContentProps {
  content: string;
  onHashtagClick?: (hashtag: string) => void;
}

export const PostContent = ({ content, onHashtagClick }: PostContentProps) => {
  const navigate = useNavigate();
  const parts = parsePostContent(content);

  const handleMentionClick = async (username: string) => {
    // Remove @ symbol
    const cleanUsername = username.replace('@', '');
    
    // Look up user by username
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .single();
    
    if (user) {
      navigate(`/profile/${user.id}`);
    }
  };

  const handleHashtagClick = (hashtag: string) => {
    // Remove # symbol
    const cleanHashtag = hashtag.replace('#', '');
    if (onHashtagClick) {
      onHashtagClick(cleanHashtag);
    }
  };

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part: ParsedContent, index: number) => {
        if (part.type === 'mention') {
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleMentionClick(part.content);
              }}
              className="text-orange-400 hover:text-orange-300 cursor-pointer font-medium transition-colors"
            >
              {part.content}
            </span>
          );
        } else if (part.type === 'hashtag') {
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                handleHashtagClick(part.content);
              }}
              className="text-blue-400 hover:text-blue-300 cursor-pointer font-medium transition-colors"
            >
              {part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
};
