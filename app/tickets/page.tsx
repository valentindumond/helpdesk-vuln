import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";

export const instant = false;

export default async function TicketPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string}>;
}) {
    const userId = (await cookies()).get("userId")?.value;
    const { q } = await searchParams;
    if(!userId){
        redirect("/login");
    }
    let tickets;
    if(q){
        const requete = `SELECT * FROM "Ticket" WHERE title LIKE '%${q}%'`;
        console.log(requete);
        tickets = await prisma.$queryRawUnsafe<{ id: number, title: string, status: string}[]>(requete);
    }else{
        tickets = await prisma.ticket.findMany({ where: { authorId: Number(userId) }});
    }
    return (
        <main>
            <h1>Mes tickets</h1>
            <form>
                <input type="text" name="q" placeholder="Recherche" defaultValue={q ?? ""}/>
                <button type="submit">Chercher</button>
            </form>
            <ul>
                {tickets.map((ticket) => (
                    <li key={ticket.id}>
                        <Link href={`/tickets/${ticket.id}`}>{ticket.title}</Link> ({ticket.status})
                    </li>
                ))}
            </ul>
        </main>
    )
}