import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const instant = false;

export default async function AdminPage(){
    const userId = (await cookies()).get("userId")?.value;
    if(!userId){
        redirect("/login");
    }
    const user = await prisma.user.findMany();
    return(
        <main>
            <h1>Administration - Tous les utilisateurs</h1>
            <ul>
                {user.map((user) => (
                    <li key={user.id}>
                        {user.email} - {user.role} - {user.password}
                    </li>
                ))}
            </ul>
        </main>
    )
}