import { PrismaClient } from "@prisma/client";
import { seedDefaultAdmin } from "../src/lib/admin-seed";
import { seedDefaultZones } from "../src/lib/zones-seed";

const prisma = new PrismaClient();

async function main() {
  const admin = await seedDefaultAdmin(prisma);
  const zonesCount = await seedDefaultZones(prisma);

  console.log("Usuario administrador listo:", {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    active: admin.active,
  });
  console.log(`Parcelas de riego iniciales creadas: ${zonesCount}`);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
