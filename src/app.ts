import { Hono } from "hono";
import { PrismaClient } from "../generated/prisma";
import * as crypto from 'crypto';

const app = new Hono();
const prisma = new PrismaClient();

// Secret Key และ Algorithm สำหรับ encryption
const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY || 'your-32-character-secret-key-here123456';
const ALGORITHM = 'aes-256-gcm';

// Interface สำหรับ encrypted data
interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

// Type definitions
interface CreateProfileRequest {
  username: string;
  mobile: string;
  cardId: string;
  password: string;
}

interface ViewProfileRequest {
  mobile: string;
  password: string;
}

// Function สำหรับเข้ารหัสข้อมูล (Encode) - แก้ไข createCipher error
function encryptData(text: string): EncryptedData {
  const iv = crypto.randomBytes(16); // สร้าง initialization vector
  const key = crypto.scryptSync(ENCRYPTION_SECRET_KEY, 'salt', 32); // สร้าง key จาก secret
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv); // ใช้ createCipheriv แทน createCipher
  cipher.setAAD(Buffer.from('additional-data')); // Additional authenticated data
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

// Function สำหรับถอดรหัสข้อมูล (Decode) - แก้ไข createDecipher error
function decryptData(encryptedData: EncryptedData): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_SECRET_KEY, 'salt', 32); // สร้าง key เดียวกัน
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv); // ใช้ createDecipheriv แทน createDecipher
  
  decipher.setAAD(Buffer.from('additional-data'));
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Helper function สำหรับเข้ารหัสข้อมูล profile
function encryptProfileData(data: { username: string; mobile: string; cardId: string }) {
  return {
    username: encryptData(data.username),
    mobile: encryptData(data.mobile),
    cardId: encryptData(data.cardId)
  };
}

// Helper function สำหรับถอดรหัสข้อมูล profile  
function decryptProfileData(encryptedData: any) {
  return {
    username: decryptData(JSON.parse(encryptedData.username)),
    mobile: decryptData(JSON.parse(encryptedData.mobile)),
    cardId: decryptData(JSON.parse(encryptedData.cardId))
  };
}

// Helper function สำหรับ hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Original routes
app.get("/", (c) => c.text("Hello, World!"));

// GET /profile - ดูข้อมูล profile ทั้งหมด (ถอดรหัสก่อนแสดง)
app.get("/profile", async (c) => {
  try {
    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
        // ไม่ select password
      },
      orderBy: { id: 'asc' }
    });

    // ถอดรหัสข้อมูลก่อนแสดงผล
    const decryptedProfiles = profiles.map(profile => {
      try {
        const decryptedData = decryptProfileData(profile);
        return {
          id: profile.id,
          username: decryptedData.username,
          mobile: decryptedData.mobile,
          cardId: decryptedData.cardId
        };
      } catch (error) {
        console.error('Error decrypting profile data:', error);
        return null;
      }
    }).filter(profile => profile !== null);

    return c.json({
      success: true,
      data: decryptedProfiles,
      count: decryptedProfiles.length
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return c.json({
      success: false,
      error: "Failed to fetch profiles"
    }, 500);
  }
});

// GET /profile/:id - ดูข้อมูล profile เฉพาะ id (ถอดรหัสก่อนแสดง)
app.get("/profile/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    if (!id) {
      return c.json({
        success: false,
        error: "Profile ID is required"
      }, 400);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: id },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
        // ไม่ select password
      }
    });

    if (!profile) {
      return c.json({
        success: false,
        error: "Profile not found"
      }, 404);
    }

    // ถอดรหัสข้อมูลก่อนแสดงผล
    try {
      const decryptedData = decryptProfileData(profile);
      const profileData = {
        id: profile.id,
        username: decryptedData.username,
        mobile: decryptedData.mobile,
        cardId: decryptedData.cardId
      };

      return c.json({
        success: true,
        data: profileData
      });
    } catch (error) {
      console.error('Error decrypting profile data:', error);
      return c.json({
        success: false,
        error: "Failed to decrypt profile data"
      }, 500);
    }

  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({
      success: false,
      error: "Failed to fetch profile"
    }, 500);
  }
});

// POST /profiles - สร้าง user ใหม่ (เข้ารหัสก่อนบันทึก)
app.post("/profiles", async (c) => {
  try {
    const body: CreateProfileRequest = await c.req.json();
    
    // Validation - ตรวจสอบข้อมูลที่จำเป็น
    if (!body.username || !body.mobile || !body.cardId || !body.password) {
      return c.json({
        success: false,
        error: "All fields are required: username, mobile, cardId, password"
      }, 400);
    }

    // ตรวจสอบ mobile format (10 หลัก)
    if (body.mobile.length !== 10) {
      return c.json({
        success: false,
        error: "Mobile number must be 10 digits"
      }, 400);
    }

    // ตรวจสอบ cardId format (13 หลัก)
    if (body.cardId.length !== 13) {
      return c.json({
        success: false,
        error: "Card ID must be 13 digits"
      }, 400);
    }

    // เข้ารหัสข้อมูลก่อนตรวจสอบ duplicate
    const encryptedData = encryptProfileData({
      username: body.username,
      mobile: body.mobile,
      cardId: body.cardId
    });

    // ตรวจสอบ duplicate โดยเปรียบเทียบข้อมูลที่เข้ารหัสแล้ว
    const allProfiles = await prisma.profile.findMany({
      select: {
        username: true,
        mobile: true,
        cardId: true
      }
    });

    // ตรวจสอบ duplicate
    for (const profile of allProfiles) {
      try {
        const decryptedProfile = decryptProfileData(profile);
        
        if (decryptedProfile.username === body.username) {
          return c.json({
            success: false,
            error: "Username already exists"
          }, 409);
        }
        
        if (decryptedProfile.mobile === body.mobile) {
          return c.json({
            success: false,
            error: "Mobile number already exists"
          }, 409);
        }
        
        if (decryptedProfile.cardId === body.cardId) {
          return c.json({
            success: false,
            error: "Card ID already exists"
          }, 409);
        }
      } catch (error) {
        // หากถอดรหัสไม่ได้ ข้าม record นี้
        continue;
      }
    }

    // Hash password ก่อนบันทึก
    const hashedPassword = hashPassword(body.password);
    console.log(`Original password: ${body.password}`);
    console.log(`Hashed password: ${hashedPassword}`);

    // สร้าง profile ใหม่ด้วยข้อมูลที่เข้ารหัสแล้ว
    const newProfile = await prisma.profile.create({
      data: {
        username: JSON.stringify(encryptedData.username), // บันทึกเป็น JSON string
        mobile: JSON.stringify(encryptedData.mobile),
        cardId: JSON.stringify(encryptedData.cardId),
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
      }
    });

    // ถอดรหัสข้อมูลก่อน return
    const decryptedNewProfile = decryptProfileData(newProfile);
    const responseData = {
      id: newProfile.id,
      username: decryptedNewProfile.username,
      mobile: decryptedNewProfile.mobile,
      cardId: decryptedNewProfile.cardId
    };

    return c.json({
      success: true,
      data: responseData,
      message: "Profile created successfully"
    }, 201);

  } catch (error) {
    console.error('Error creating profile:', (error as Error).message); // แก้ไข error type
    return c.json({
      success: false,
      error: "Failed to create profile"
    }, 500);
  }
});

// POST /profiles/view - ดูข้อมูล (ต้องใส่ mobile + password, ถอดรหัสก่อนแสดง)
app.post("/profiles/view", async (c) => {
  try {
    const body: ViewProfileRequest = await c.req.json();
    
    // Validation
    if (!body.mobile || !body.password) {
      return c.json({
        success: false,
        error: "Mobile and password are required"
      }, 400);
    }

    // ค้นหา profile โดยเปรียบเทียบข้อมูลที่ถอดรหัสแล้ว
    const allProfiles = await prisma.profile.findMany();
    let matchedProfile = null;

    for (const profile of allProfiles) {
      try {
        const decryptedData = decryptProfileData({
          username: profile.username,
          mobile: profile.mobile,
          cardId: profile.cardId
        });
        
        if (decryptedData.mobile === body.mobile) {
          matchedProfile = profile;
          break;
        }
      } catch (error) {
        // หากถอดรหัสไม่ได้ ข้าม record นี้
        continue;
      }
    }

    if (!matchedProfile) {
      return c.json({
        success: false,
        error: "User not found"
      }, 404);
    }

    // ตรวจสอบ password
    const hashedInputPassword = hashPassword(body.password);

    if (matchedProfile.password !== hashedInputPassword) {
      return c.json({
        success: false,
        error: "Invalid password"
      }, 401);
    }

    // Password ถูกต้อง - ถอดรหัสข้อมูลก่อน return
    const decryptedProfile = decryptProfileData({
      username: matchedProfile.username,
      mobile: matchedProfile.mobile,
      cardId: matchedProfile.cardId
    });

    const profileData = {
      id: matchedProfile.id,
      username: decryptedProfile.username,
      mobile: decryptedProfile.mobile,
      cardId: decryptedProfile.cardId
    };

    return c.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('Error viewing profile:', (error as Error).message); // แก้ไข error type
    return c.json({
      success: false,
      error: "Failed to retrieve profile"
    }, 500);
  }
});

// POST /profiles/login - Login ด้วย username + password (ถอดรหัสก่อนแสดง)
app.post("/profiles/login", async (c) => {
  try {
    const body: any = await c.req.json();
    
    // Validation
    if (!body.username || !body.password) {
      return c.json({
        success: false,
        error: "Username and password are required"
      }, 400);
    }

    // ค้นหา profile โดยเปรียบเทียบข้อมูลที่ถอดรหัสแล้ว
    const allProfiles = await prisma.profile.findMany();
    let matchedProfile = null;

    for (const profile of allProfiles) {
      try {
        const decryptedData = decryptProfileData({
          username: profile.username,
          mobile: profile.mobile,
          cardId: profile.cardId
        });
        
        if (decryptedData.username === body.username) {
          matchedProfile = profile;
          break;
        }
      } catch (error) {
        // หากถอดรหัสไม่ได้ ข้าม record นี้
        continue;
      }
    }

    if (!matchedProfile) {
      return c.json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    // ตรวจสอบ password
    const hashedInputPassword = hashPassword(body.password);

    if (matchedProfile.password !== hashedInputPassword) {
      return c.json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    // Login สำเร็จ - ถอดรหัสข้อมูลก่อน return
    const decryptedProfile = decryptProfileData({
      username: matchedProfile.username,
      mobile: matchedProfile.mobile,
      cardId: matchedProfile.cardId
    });

    const profileData = {
      id: matchedProfile.id,
      username: decryptedProfile.username,
      mobile: decryptedProfile.mobile,
      cardId: decryptedProfile.cardId
    };

    return c.json({
      success: true,
      data: profileData,
      message: "Login successful"
    });

  } catch (error) {
    console.error('Error during login:', (error as Error).message); // แก้ไข error type
    return c.json({
      success: false,
      error: "Login failed"
    }, 500);
  }
});

// Health Check และทดสอบ Encryption
app.get('/health', (c) => {
  try {
    // ทดสอบ encryption/decryption
    const testData = 'test_encryption_123';
    const encrypted = encryptData(testData);
    const decrypted = decryptData(encrypted);
    
    if (decrypted !== testData) {
      throw new Error('Encryption/Decryption test failed');
    }
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      encryption: 'working',
      secret_key_loaded: !!process.env.ENCRYPTION_SECRET_KEY
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: (error as Error).message // แก้ไข error type
    }, 500);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;