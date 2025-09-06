import { Hono } from "hono";
import { PrismaClient } from "../generated/prisma";

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

    // สร้าง profile ใหม่ (id จะ generate เป็น uuid อัตโนมัติ)
    const newProfile = await prisma.profile.create({
      data: {
        username: body.username,
        mobile: body.mobile,
        cardId: body.cardId,
        password: body.password // ในการใช้งานจริงควร hash password
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
// ค้นหา profile ด้วย mobile และ password
    const profile = await prisma.profile.findFirst({
      where: {
        mobile: body.mobile,
        password: body.password
      },
      select: {
        id: true,
        username: true,
        mobile: true,
        cardId: true
        // ไม่ select password เพื่อไม่ให้ return ใน response
      }
    });

    if (!profile) {
      return c.json({
        success: false,
        error: "Invalid mobile number or password"
      }, 401);
    }

    return c.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Error viewing profile:', error);
    return c.json({
      success: false,
      error: "Failed to retrieve profile"
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

export default app;
