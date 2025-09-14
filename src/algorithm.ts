import * as crypto from "crypto";

/**
 * algorithm
 * key
 * iv
 */

const algorithm = "aes-256-cbc";
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const password = "MyVerySecurePassword";

console.log("algorithm ", algorithm);
console.log("key ", key.toString('hex'));
console.log("iv ", iv.toString('hex'));
console.log("password ", password);

const encodeCipher = crypto.createCipheriv(algorithm, key, iv);
// console.log("encodeCipher ", encodeCipher);
const encrypted = encodeCipher.update(password, 'utf-8', 'base64');
const final = encrypted + encodeCipher.final('base64');
console.log("encrypted(final)", final, final.length);

const decodeCipher = crypto.createDecipheriv(algorithm, key, iv);
// console.log("decodeCipher ", decodeCipher);
const decrypted = decodeCipher.update(final, 'base64', 'utf-8');
const d_final = decrypted + decodeCipher.final('utf-8');
console.log("decrypted(final) ", d_final);