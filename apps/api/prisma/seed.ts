import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = ["CUSTOMER", "SELLER", "ADMIN"];

  for (const code of roles) {
    await prisma.role.upsert({
      where: {
        code,
      },
      update: {},
      create: {
        code,
      },
    });
  }

  console.log("Roles seeded successfully");
}

main()
  .catch((error) => {
    console.error("Role seeding failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });