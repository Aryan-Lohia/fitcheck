import { PrismaClient, FreelancerVerificationStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** All seeded account emails — removed before re-seed for a clean run */
const SEED_EMAILS = [
  "admin@fitcheck.local",
  "ava@fitcheck.local",
  "morgan@fitcheck.local",
  "freelancer.approved@fitcheck.local",
  "freelancer.pending@fitcheck.local",
  "freelancer.draft@fitcheck.local",
  "freelancer.rejected@fitcheck.local",
] as const;

const ADMIN_PASSWORD = "Admin@12345";
const DEMO_PASSWORD = "FitCheck!demo";

const now = new Date().toISOString();

/** Rich measurements: wizard keys + fit-engine keys (chest/waist/hip/shoulder/sleeve/inseam) */
function fullMeasurements(overrides: Record<string, number> = {}) {
  const base = {
    heightCm: 170,
    chestCm: 92,
    waistCm: 78,
    hipCm: 96,
    shoulderCm: 44,
    sleeveCm: 60,
    inseamCm: 78,
    neckCm: 37,
    armLengthCm: 59,
    thighCm: 56,
    bustCm: 90,
    chest: 92,
    waist: 78,
    hip: 96,
    shoulder: 44,
    sleeve: 60,
    inseam: 78,
  };
  return { ...base, ...overrides };
}

function measurementsJson(values: Record<string, number>) {
  return {
    versions: [{ at: now, values }],
  };
}

async function main() {
  const [adminHash, demoHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 12),
    bcrypt.hash(DEMO_PASSWORD, 12),
  ]);

  await prisma.user.deleteMany({
    where: { email: { in: [...SEED_EMAILS] } },
  });

  // —— Admin (single account) ——
  await prisma.user.create({
    data: {
      name: "FitCheck Admin",
      email: "admin@fitcheck.local",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      profile: {
        create: {
          gender: "Prefer not to say",
          skinTone: "medium",
          preferredFit: "regular",
          preferredStyle: ["Formal Wear", "Minimalist"],
          preferredColors: ["black", "navy"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(fullMeasurements({ heightCm: 175, chestCm: 98 })),
        },
      },
    },
  });

  // —— Regular users (complete profiles) ——
  await prisma.user.create({
    data: {
      name: "Ava Chen",
      email: "ava@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.USER,
      profile: {
        create: {
          gender: "Woman",
          skinTone: "light",
          preferredFit: "regular",
          preferredStyle: ["Casual Wear", "Minimalist", "Sustainable Fashion"],
          preferredColors: ["sage", "cream", "denim blue"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(fullMeasurements()),
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      name: "Morgan Blake",
      email: "morgan@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.USER,
      profile: {
        create: {
          gender: "Man",
          skinTone: "deep",
          preferredFit: "slim",
          preferredStyle: ["Formal Wear", "Streetwear"],
          preferredColors: ["charcoal", "burgundy", "white"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(
            fullMeasurements({
              heightCm: 182,
              chestCm: 102,
              waistCm: 84,
              hipCm: 98,
              shoulderCm: 48,
              sleeveCm: 64,
              inseamCm: 81,
              chest: 102,
              waist: 84,
              hip: 98,
              shoulder: 48,
              sleeve: 64,
              inseam: 81,
            }),
          ),
        },
      },
    },
  });

  // —— Freelance: approved ——
  await prisma.user.create({
    data: {
      name: "Riley Santos",
      email: "freelancer.approved@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.FREELANCE_USER,
      profile: {
        create: {
          gender: "Non-binary",
          skinTone: "medium",
          preferredFit: "oversized",
          preferredStyle: ["Styling", "Color Analysis", "Wardrobe Planning"],
          preferredColors: ["terracotta", "olive", "ivory"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(
            fullMeasurements({ heightCm: 165, chestCm: 86, waistCm: 70, hipCm: 92 }),
          ),
        },
      },
      freelancer: {
        create: {
          bio: "Personal stylist & color analyst. 8+ years helping clients build capsule wardrobes and shop with confidence.",
          portfolioLinksJson: [
            "https://example.com/portfolio/riley-santos",
            "https://example.com/lookbook/rs-2024",
          ],
          pastWorkLinksJson: [
            "https://example.com/case-studies/retail-refresh",
            "https://example.com/case-studies/bridal-edits",
          ],
          expertiseTagsJson: [
            "Styling",
            "Color Analysis",
            "Body Type",
            "Wardrobe Planning",
            "Fit Expert",
          ],
          verificationStatus: FreelancerVerificationStatus.approved,
          verificationNotes: null,
          approvedAt: new Date(),
        },
      },
    },
  });

  // —— Freelance: pending review (submitted) ——
  await prisma.user.create({
    data: {
      name: "Jordan Lee",
      email: "freelancer.pending@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.FREELANCE_USER,
      profile: {
        create: {
          gender: "Woman",
          skinTone: "tan",
          preferredFit: "tailored",
          preferredStyle: ["Bridal", "Formal Wear"],
          preferredColors: ["champagne", "blush", "pearl"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(fullMeasurements({ heightCm: 168 })),
        },
      },
      freelancer: {
        create: {
          bio: "Bridal and occasion-wear specialist. Former department-store lead stylist.",
          portfolioLinksJson: ["https://example.com/jordan-lee-styling"],
          pastWorkLinksJson: ["https://example.com/weddings/jordan-featured"],
          expertiseTagsJson: ["Bridal", "Formal Wear", "Shopping Assistance"],
          verificationStatus: FreelancerVerificationStatus.submitted,
          verificationNotes: null,
          approvedAt: null,
        },
      },
    },
  });

  // —— Freelance: draft (not submitted) ——
  await prisma.user.create({
    data: {
      name: "Casey Kim",
      email: "freelancer.draft@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.FREELANCE_USER,
      profile: {
        create: {
          gender: "Man",
          skinTone: "light",
          preferredFit: "regular",
          preferredStyle: ["Casual Wear", "Fit Expert"],
          preferredColors: ["navy", "grey", "white"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(fullMeasurements({ heightCm: 178 })),
        },
      },
      freelancer: {
        create: {
          bio: null,
          portfolioLinksJson: [],
          pastWorkLinksJson: [],
          expertiseTagsJson: ["Fit Expert"],
          verificationStatus: FreelancerVerificationStatus.draft,
          verificationNotes: null,
          approvedAt: null,
        },
      },
    },
  });

  // —— Freelance: rejected ——
  await prisma.user.create({
    data: {
      name: "Taylor Brooks",
      email: "freelancer.rejected@fitcheck.local",
      passwordHash: demoHash,
      role: UserRole.FREELANCE_USER,
      profile: {
        create: {
          gender: "Woman",
          skinTone: "deep",
          preferredFit: "regular",
          preferredStyle: ["Streetwear", "Sustainable Fashion"],
          preferredColors: ["black", "neon accent", "earth tones"],
          profileCompletion: 100,
          measurementsJson: measurementsJson(fullMeasurements({ heightCm: 172 })),
        },
      },
      freelancer: {
        create: {
          bio: "Urban style consultant focusing on sustainable streetwear.",
          portfolioLinksJson: ["https://example.com/taylor-style"],
          pastWorkLinksJson: [],
          expertiseTagsJson: ["Shopping Assistance", "Sustainable Fashion"],
          verificationStatus: FreelancerVerificationStatus.rejected,
          verificationNotes:
            "Please add at least two verifiable portfolio links and resubmit.",
          approvedAt: null,
        },
      },
    },
  });

  console.log("\n✅ FitCheck seed complete.\n");
  console.log("── Admin (single) ──");
  console.log(`  Email:    admin@fitcheck.local`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);
  console.log("── Demo users & freelancers (same password) ──");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("  • ava@fitcheck.local              — USER, full profile");
  console.log("  • morgan@fitcheck.local           — USER, full profile");
  console.log("  • freelancer.approved@fitcheck.local  — FREELANCE_USER, approved");
  console.log("  • freelancer.pending@fitcheck.local   — FREELANCE_USER, submitted");
  console.log("  • freelancer.draft@fitcheck.local     — FREELANCE_USER, draft");
  console.log("  • freelancer.rejected@fitcheck.local  — FREELANCE_USER, rejected\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
