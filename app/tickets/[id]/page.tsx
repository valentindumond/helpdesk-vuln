import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";


export const instant = false;

export default async function TicketDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const userId = (await cookies()).get("userId")?.value;
    if(!userId){
        redirect("/login");
    }
    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
        where: { id: Number(id) },
        include: { author: true, comments: {include: {author: true}}},
    })

    if(!ticket){
        notFound();
    }

    return (
        <main>
            <h1>{ticket.title}</h1>
            <p>Par {ticket.author.email} ({ticket.status})</p>
            <p>{ticket.description}</p>

            <h2>Commentaires</h2>
            <ul>
                {ticket.comments.map((comment) => (
                    <li key={comment.id}>
                        {comment.author.email} : {comment.content}
                    </li>
                ))}
            </ul>
        </main>
    )
}