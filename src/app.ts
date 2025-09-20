import { Hono } from "hono";
import { PrismaClient } from "../generated/prisma";
import * as crypto from 'crypto';
//import { encode, decode } from "./security";
import { encryptProfile, decryptProfile, encryptData } from "./algorithm";

const app = new Hono();
const prisma = new PrismaClient();

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

// Helper function สำหรับ hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Original routes
app.get("/", (c) => c.text("Hello, World!"));
app.get("/profile", (c) => c.text("Profile Page"));

// Create new profile - สร้าง user ใหม่
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

    // ตรวจสอบว่า username ซ้ำหรือไม่
    const existingUsername = await prisma.profile.findUnique({
      where: { username: body.username }
    });

    if (existingUsername) {
      return c.json({
        success: false,
        error: "Username already exists"
      }, 409);
    }

    // ตรวจสอบว่า mobile ซ้ำหรือไม่
    const existingMobile = await prisma.profile.findUnique({
      where: { mobile: body.mobile }
    });

    if (existingMobile) {
      return c.json({
        success: false,
        error: "Mobile number already exists"
      }, 409);
    }

    // ตรวจสอบว่า cardId ซ้ำหรือไม่
    const existingCardId = await prisma.profile.findUnique({
      where: { cardId: body.cardId }
    });

    if (existingCardId) {
      return c.json({
        success: false,
        error: "Card ID already exists"
      }, 409);
    }

    // Hash password ก่อนบันทึก
    const hashedPassword = hashPassword(body.password);
    console.log(`Original password: ${body.password}`);
    console.log(`Hashed password: ${hashedPassword}`);

    // สร้าง profile ใหม่ (id จะ generate เป็น uuid อัตโนมัติ)
    const newProfile = await prisma.profile.create({
      data: {
        username: body.username,
        mobile: body.mobile,
        cardId: body.cardId,
        password: hashedPassword // บันทึก hashed password
      },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
        // ไม่ select password เพื่อไม่ให้ return ใน response
      }
    });

    return c.json({
      success: true,
      data: newProfile,
      message: "Profile created successfully"
    }, 201);

  } catch (error) {
    console.error('Error creating profile:', error);
    return c.json({
      success: false,
      error: "Failed to create profile"
    }, 500);
  }
});

// View profile - ดูข้อมูล (ต้องใส่ mobile + password)
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

    // ค้นหา profile ด้วย mobile
    /*const profile = await prisma.profile.findUnique({
      where: { mobile: body.mobile }
    });*/
    let profile = await prisma.profile.findUnique({
      where: {mobile: body.mobile}
    })
    if (!profile) {
      const encryptedMobile = encryptData(body.mobile);
      profile = await prisma.profile.findUnique({
      where: { mobile: encryptedMobile }
      });
    }

    if (!profile) {
      return c.json({
        success: false,
        error: "User not found"
      }, 404);
    }

    // Hash password ที่ user ป้อนเข้ามาแล้วเปรียบเทียบ
    const hashedInputPassword = hashPassword(body.password);

    if (profile.password !== hashedInputPassword) {
      return c.json({
        success: false,
        error: "Invalid password"
      }, 401);
    }

    // Password ถูกต้อง - return ข้อมูล profile
    const profileData = {
      id: profile.id,
      username: profile.username,
      mobile: profile.mobile,
      cardId: profile.cardId
    };

    return c.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('Error viewing profile:', error);
    return c.json({
      success: false,
      error: "Failed to retrieve profile"
    }, 500);
  }
});

// Login - ด้วย username + password
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

    // ค้นหา profile ด้วย username
    /*const profile = await prisma.profile.findUnique({
      where: { username: body.username }
    });*/
    let profile = await prisma.profile.findUnique({
      where: {username: body.username}
    })

    if(!profile){
      const encryptedUsername = encryptData(body.username);
      profile = await prisma.profile.findUnique({
        where: {username: encryptedUsername}
      })
    }

    if (!profile) {
      return c.json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    // Hash password ที่ user ป้อนเข้ามาแล้วเปรียบเทียบ
    const hashedInputPassword = hashPassword(body.password);

    if (profile.password !== hashedInputPassword) {
      return c.json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    // Login สำเร็จ - return ข้อมูล profile
    const profileData = {
      id: profile.id,
      username: profile.username,
      mobile: profile.mobile,
      cardId: profile.cardId
    };

    return c.json({
      success: true,
      data: profileData,
      message: "Login successful"
    });

  } catch (error) {
    console.error('Error during login:', error);
    return c.json({
      success: false,
      error: "Login failed"
    }, 500);
  }
});

// Get all profiles (bonus - สำหรับ admin ดูรายการทั้งหมด)
app.get("/profiles", async (c) => {
  try {
    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
        // ไม่ select password
      },
      orderBy: { username: 'asc' }
    });

    return c.json({
      success: true,
      data: profiles,
      count: profiles.length
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return c.json({
      success: false,
      error: "Failed to fetch profiles"
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

// 3. แก้ POST /encode
app.post("/encode", async (c) => {
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

    // ตรวจสอบว่า username ซ้ำหรือไม่
    const existingUsername = await prisma.profile.findUnique({
      where: { username: body.username }
    });

    if (existingUsername) {
      return c.json({
        success: false,
        error: "Username already exists"
      }, 409);
    }

    // ตรวจสอบว่า mobile ซ้ำหรือไม่
    const existingMobile = await prisma.profile.findUnique({
      where: { mobile: body.mobile }
    });

    if (existingMobile) {
      return c.json({
        success: false,
        error: "Mobile number already exists"
      }, 409);
    }

    // ตรวจสอบว่า cardId ซ้ำหรือไม่
    const existingCardId = await prisma.profile.findUnique({
      where: { cardId: body.cardId }
    });

    if (existingCardId) {
      return c.json({
        success: false,
        error: "Card ID already exists"
      }, 409);
    }

    // Hash password ก่อนบันทึก
    const hashedPassword = hashPassword(body.password);

    // เข้ารหัสข้อมูลก่อนบันทึก
    const encryptedData = encryptProfile({
      username: body.username,
      mobile: body.mobile,
      cardId: body.cardId
    });

    // สร้าง profile ใหม่ด้วยข้อมูลที่เข้ารหัสแล้ว
    const newProfile = await prisma.profile.create({
      data: {
        username: encryptedData.username,
        mobile: encryptedData.mobile,
        cardId: encryptedData.cardId,
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
      }
    });

    return c.json({
      success: true,
      data: newProfile,
      message: "Encrypted profile created successfully"
    }, 201);

  } catch (error) {
    console.error('Error creating encrypted profile:', error);
    return c.json({
      success: false,
      error: "Failed to create encrypted profile"
    }, 500);
  }
});

// 4. แก้ POST /decode
app.post("/decode", async (c) => {
  try {
    const body: { id: string } = await c.req.json();
    
    // Validation
    if (!body.id) {
      return c.json({
        success: false,
        error: "Profile ID is required"
      }, 400);
    }

    // ค้นหา profile ด้วย id
    const profile = await prisma.profile.findUnique({
      where: { id: body.id },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
      }
    });

    if (!profile) {
      return c.json({
        success: false,
        error: "Profile not found"
      }, 404);
    }

    // ถอดรหัสข้อมูล
    const decryptedData = decryptProfile({
      username: profile.username,
      mobile: profile.mobile,
      cardId: profile.cardId
    });

    const profileData = {
      id: profile.id,
      username: decryptedData.username,
      mobile: decryptedData.mobile,
      cardId: decryptedData.cardId
    };

    return c.json({
      success: true,
      data: profileData,
      message: "Profile decrypted successfully"
    });

  } catch (error) {
    console.error('Error decrypting profile:', error);
    return c.json({
      success: false,
      error: "Failed to decrypt profile"
    }, 500);
  }
});

// 2. เพิ่ม GET /profile/:id (หลัง GET /profiles)
app.get("/profile/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    // Validation
    if (!id) {
      return c.json({
        success: false,
        error: "Profile ID is required"
      }, 400);
    }

    // ค้นหา profile ด้วย id
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

    return c.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({
      success: false,
      error: "Failed to fetch profile"
    }, 500);
  }
});

export default app;