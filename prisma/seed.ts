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

  // Real OLI Architecture project list
  const projects = [
    { name: "[1605] Anji", code: "1605" },
    { name: "[200106] Suzhou Metro", code: "200106" },
    { name: "[201014] BSM_ServiceCenter", code: "201014" },
    { name: "[201024] Diageo", code: "201024" },
    { name: "201209_DBM_StoneCarvingMuseum", code: "201209" },
    { name: "210416_POT_Fairholme", code: "210416" },
    { name: "210505_Ortho Office", code: "210505" },
    { name: "210830_Florida Vernacular House", code: "210830" },
    { name: "220214_Ningbo Yinzhou", code: "220214" },
    { name: "230810_WUXI Toy Factory Renovation", code: "230810" },
    { name: "230921_Zhengzhou ICCC", code: "230921" },
    { name: "231116_Shimizu RRA conversion", code: "231116" },
    { name: "240206_PalaceMuseumQianlongGarden", code: "240206" },
    { name: "240515_Guangzhou urban renewal", code: "240515" },
    { name: "241216_QuanxingChineseWine_VC", code: "241216" },
    { name: "250113_Autec Soho", code: "250113" },
    { name: "250605_WuZhen Renovation", code: "250605" },
    { name: "240406_AtenReign", code: "240406" },
    { name: "240419_NMAD competition", code: "240419" },
    { name: "240507_PalaceMuseum100thAnniversary", code: "240507" },
    { name: "240510_LS Cultre Park Competition", code: "240510" },
    { name: "240527_TibetanWhiskeyDistillery", code: "240527" },
    { name: "240613_WestchesterModern", code: "240613" },
    { name: "240626_Doha_IMP_Retrospective", code: "240626A" },
    { name: "240626_Sanhome Shanghai headquarter", code: "240626B" },
    { name: "240724_LKHmuseum", code: "240724" },
    { name: "240729_SuzhouHotelOffice", code: "240729" },
    { name: "240903_Jokhang_TempleExhibition", code: "240903" },
    { name: "240906_chaoyangpark_artmuseum", code: "240906" },
    { name: "250224_ChikanCanalTownMuseums", code: "250224" },
    { name: "250302_SCD Waterfront Park AbuDhabi", code: "250302" },
    { name: "250311_123West74th", code: "250311" },
    { name: "250313_KSA_Residence", code: "250313" },
    { name: "250401_111W57", code: "250401" },
    { name: "250430_Shenzhen Oceangraphic Museum", code: "250430" },
    { name: "250722_QM_HertiageMuseums", code: "250722" },
    { name: "250801_5WetzelCt", code: "250801" },
    { name: "250804_LouvreCompetition", code: "250804" },
    { name: "250930_Zibo ceramic and glass museum", code: "250930" },
    { name: "251016_Nanjing_Suzhou", code: "251016" },
    { name: "251022_DBM Hotel + Chapel", code: "251022" },
    { name: "251113_Sanhome Suzhou", code: "251113" },
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
