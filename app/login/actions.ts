"use server";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function login(formData: FormData){
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const hash = createHash("md5").update(password).digest("hex");
    const requete =  `SELECT * FROM "User" WHERE email = '${email}' AND password = '${hash}'`;
    console.log(requete);
    const users = await prisma.$queryRawUnsafe<{ id: number; email: string}[]>(requete);
    if(users.length === 0){
        redirect("/login?error=1");
    } 
    const user = users[0];
    (await cookies()).set("userId", String(user.id));
    redirect("/tickets");
}