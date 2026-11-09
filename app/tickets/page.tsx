import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const instant = false;

export default async function TicketPage(){
    const userId = (await cookies()).get("userId")?.value;
    if(!userId){
        redirect("/login");
    }
    const tickets = await prisma.ticket.findMany({
        where: {authorId: Number(userId)}
    });
    return (
        <main>
            <h1>Mes tickets</h1>
            <ul>
                {tickets.map((ticket) => (
                    <li key={ticket.id}>
                        {ticket.title} {ticket.status}
                    </li>
                ))}
            </ul>
        </main>
    )
}