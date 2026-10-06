const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** A Solana public key is exactly 32 bytes when decoded from base58. */
export function isSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  let value = BigInt(0);
  for (const character of address) {
    const digit = alphabet.indexOf(character);
    if (digit === -1) return false;
    value = value * BigInt(58) + BigInt(digit);
  }
  let bytes = 0;
  while (value > BigInt(0)) { bytes++; value >>= BigInt(8); }
  for (const character of address) { if (character !== "1") break; bytes++; }
  return bytes === 32;
}
