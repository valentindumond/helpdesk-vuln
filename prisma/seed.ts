import { PrismaClient } from "../app/generated/prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

async function main() {
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "admin@helpdesk.local", password: md5("admin123"), role: "ADMIN" },
  });
  const alice = await prisma.user.create({
    data: { email: "alice@helpdesk.local", password: md5("alice123") },
  });
  const bob = await prisma.user.create({
    data: { email: "bob@helpdesk.local", password: md5("bob123") },
  });

  const t1 = await prisma.ticket.create({
    data: { title: "Impossible de me connecter", description: "Mon mot de passe est refusé.", authorId: alice.id },
  });
  await prisma.ticket.create({
    data: { title: "Imprimante en panne", description: "Plus de réponse au 2e étage.", authorId: bob.id },
  });
  await prisma.comment.create({
    data: { content: "Pouvez-vous préciser le message d'erreur ?", ticketId: t1.id, authorId: admin.id },
  });
}

main().finally(() => prisma.$disconnect());
