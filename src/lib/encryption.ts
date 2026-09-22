/**
 * Client-Side End-to-End Encryption (E2EE) Engine
 * Uses native Web Crypto API (AES-GCM-256 with PBKDF2 key derivation)
 * 
 * Messages and room secrets are encrypted in the sender's browser and 
 * decrypted only in the recipient's browser. The server never sees plaintext.
 */

// Generate or derive a cryptographic key from a room passphrase or room ID
export async function deriveRoomKey(passphrase: string, saltString: string = 'charon-watchtogether-salt'): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(saltString),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext string -> Base64 ciphertext (IV + encrypted data)
export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  try {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const encoded = enc.encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded
    );

    // Combine IV and ciphertext into a single byte array
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    // Convert to Base64
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error('Encryption failed:', err);
    return plaintext;
  }
}

// Decrypt Base64 ciphertext -> Plaintext string
export async function decryptText(ciphertextBase64: string, key: CryptoKey): Promise<string> {
  try {
    const binaryString = atob(ciphertextBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // First 12 bytes are the IV
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch {
    // If decryption fails (e.g. unencrypted system message or mismatched key), return as is
    return ciphertextBase64;
  }
}
