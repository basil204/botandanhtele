import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Seed script cleared as per user request to remove default staff member
    console.log('Seed script is now empty.')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
