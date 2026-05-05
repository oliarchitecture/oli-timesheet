import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.employee.upsert({
    where: { email: "admin@oliarch.com" },
    update: {},
    create: {
      name: "OLI Admin",
      email: "admin@oliarch.com",
      passwordHash,
      role: Role.ADMIN,
      title: "Office Manager",
      isActive: true,
    },
  });

  console.log("Created admin:", admin.email);

  // Clear old projects (safe — no timesheet entries exist yet in fresh setup)
  await prisma.project.deleteMany({});

  // Placeholder projects — replace with your actual project list before seeding production
  const projects = [
    { name: "001_Office Admin", code: "ADMIN" },
    { name: "Project Alpha", code: "P001" },
    { name: "Project Beta", code: "P002" },
    { name: "Project Gamma", code: "P003" },
  ];

  await prisma.project.createMany({ data: projects });

  console.log(`Created ${projects.length} projects`);
  console.log("\nSeed complete!");
  console.log("\nAdmin credentials:");
  console.log("  Email: admin@oliarch.com");
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
