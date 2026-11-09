"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function addComment(formData : FormData){
    const userId = (await cookies()).get("userId")?.value;
    if(!userId){
        redirect("/login");
    }

    const ticketId = Number(formData.get("ticketId"));
    const content = String(formData.get("content"));

    await prisma.comment.create({
        data: { content: content, ticketId: ticketId, authorId: Number(userId) },
    });

    redirect(`/tickets/${ticketId}`);
}