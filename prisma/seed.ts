import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.employee.upsert({
    where: { email: "admin@oliarchitecture.com" },
    update: {},
    create: {
      name: "OLI Admin",
      email: "admin@oliarchitecture.com",
      passwordHash,
      role: Role.ADMIN,
      title: "Office Manager",
      isActive: true,
    },
  });

  console.log("Created admin:", admin.email);

  // Create sample projects
  const projects = [
    { name: "Office Renovation — Downtown", clientName: "Smith & Co", code: "OLI-2024-001" },
    { name: "Residential Complex", clientName: "Green Developments", code: "OLI-2024-002" },
    { name: "Community Center", clientName: "City of Westfield", code: "OLI-2024-003" },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.code },
      update: {},
      create: project,
    });
  }

  console.log("Created sample projects");
  console.log("\nSeed complete!");
  console.log("\nAdmin credentials:");
  console.log("  Email: admin@oliarchitecture.com");
  console.log("  Password: admin123");
  console.log("\nIMPORTANT: Change the admin password after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
