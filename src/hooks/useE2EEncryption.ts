import { useState, useCallback, useEffect } from 'react';

// AES-GCM encryption for end-to-end encrypted messaging
// Keys are generated per-match and stored locally

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

interface EncryptionKeys {
  [matchId: string]: CryptoKey;
}

// Generate a random encryption key
const generateKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable for storage
    ['encrypt', 'decrypt']
  );
};

// Export key to base64 for storage
const exportKey = async (key: CryptoKey): Promise<string> => {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)));
};

// Import key from base64
const importKey = async (keyString: string): Promise<CryptoKey> => {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
};

// Encrypt message
const encryptMessage = async (message: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
  };
};

// Decrypt message
const decryptMessage = async (ciphertext: string, iv: string, key: CryptoKey): Promise<string> => {
  try {
    const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: ivData },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Encrypted Message - Unable to decrypt]';
  }
};

export const useE2EEncryption = (matchId: string | undefined) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [keyFingerprint, setKeyFingerprint] = useState<string>('');

  // Initialize or load encryption key for this match
  useEffect(() => {
    if (!matchId) return;

    const initializeKey = async () => {
      const storageKey = `e2e_key_${matchId}`;
      const storedKey = localStorage.getItem(storageKey);
      
      let key: CryptoKey;
      
      if (storedKey) {
        // Load existing key
        key = await importKey(storedKey);
      } else {
        // Generate new key
        key = await generateKey();
        const exportedKey = await exportKey(key);
        localStorage.setItem(storageKey, exportedKey);
      }
      
      setEncryptionKey(key);
      
      // Generate fingerprint for verification
      const exportedKey = await exportKey(key);
      const fingerprint = exportedKey.slice(0, 8).toUpperCase();
      setKeyFingerprint(fingerprint);
      
      setIsInitialized(true);
    };

    initializeKey();
  }, [matchId]);

  const encrypt = useCallback(async (message: string): Promise<{ encrypted: string; iv: string } | null> => {
    if (!encryptionKey || !message) return null;
    
    try {
      const { ciphertext, iv } = await encryptMessage(message, encryptionKey);
      return { encrypted: ciphertext, iv };
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }, [encryptionKey]);

  const decrypt = useCallback(async (encryptedContent: string): Promise<string> => {
    if (!encryptionKey || !encryptedContent) return encryptedContent;
    
    try {
      // Parse the encrypted content (format: iv:ciphertext)
      const [iv, ciphertext] = encryptedContent.split(':');
      if (!iv || !ciphertext) return encryptedContent;
      
      return await decryptMessage(ciphertext, iv, encryptionKey);
    } catch (error) {
      console.error('Decryption error:', error);
      return '[Unable to decrypt message]';
    }
  }, [encryptionKey]);

  const formatEncryptedContent = (iv: string, ciphertext: string): string => {
    return `${iv}:${ciphertext}`;
  };

  return {
    encrypt,
    decrypt,
    formatEncryptedContent,
    isInitialized,
    keyFingerprint,
    hasEncryption: !!encryptionKey
  };
};
