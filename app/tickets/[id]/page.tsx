import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { addComment } from "./actions";

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

    const ticketId = Number(id);
    if (Number.isNaN(ticketId)) {
        notFound();
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id:ticketId },
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
                        {comment.author.email} : <span dangerouslySetInnerHTML={{ __html: comment.content }}/>
                    </li>
                ))}
            </ul>
            <form action={addComment}>
                <input type="hidden" name="ticketId" value={ticket.id}></input>
                <textarea name="content" placeholder="Votre commentaire"></textarea>
                <button type="submit">Commenter</button>
            </form>
        </main>
    )
}