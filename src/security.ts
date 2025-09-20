import * as crypto from "crypto";

const algorithm = "aes-256-cbc";

/**
 * Core encode function (encrypt)
 */
export const encode = (data: string, key: Buffer, iv: Buffer): string => {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, "utf-8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
};

/**
 * Core decode function (decrypt)
 */
export const decode = (encryptedData: string, key: Buffer, iv: Buffer): string => {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
};

export default { encode, decode };