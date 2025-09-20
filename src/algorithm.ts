import * as dotenv from "dotenv";
import { encode, decode } from "./security";

/**
 * algorithm
 * key
 * iv
 */

// Load environment variables
dotenv.config();

// Get encryption settings from environment variables
const SECURITY_KEY = process.env.SECURITY_KEY;
const CRYPTO_KEY = Buffer.from(process.env.CRYPTO_KEY || "", "hex");
const CRYPTO_IV = Buffer.from(process.env.CRYPTO_IV || "", "hex");

// Validate required environment variables
if (!SECURITY_KEY) {
    throw new Error("SECURITY_KEY is required in environment variables");
}

if (!process.env.CRYPTO_KEY) {
    throw new Error("CRYPTO_KEY is required in environment variables");
}

if (!process.env.CRYPTO_IV) {
    throw new Error("CRYPTO_IV is required in environment variables");
}

/**
 * Encrypt data using security functions
 */
export const encryptData = (data: string): string => {
    return encode(data, CRYPTO_KEY, CRYPTO_IV);
};

/**
 * Decrypt data using security functions
 */
export const decryptData = (encryptedData: string): string => {
    return decode(encryptedData, CRYPTO_KEY, CRYPTO_IV);
};

/**
 * Encrypt profile data
 */
export const encryptProfile = (profileData: any): any => {
    return {
        ...profileData,
        username: encryptData(profileData.username),
        mobile: encryptData(profileData.mobile),
        cardId: encryptData(profileData.cardId)
    };
};

/**
 * Decrypt profile data
 */
export const decryptProfile = (encryptedProfile: any): any => {
    return {
        ...encryptedProfile,
        username: decryptData(encryptedProfile.username),
        mobile: decryptData(encryptedProfile.mobile),
        cardId: decryptData(encryptedProfile.cardId)
    };
};

export default { encryptData, decryptData, encryptProfile, decryptProfile };