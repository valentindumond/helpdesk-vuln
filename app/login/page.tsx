import { login } from "./actions";

export const instant = false;

export default async function LoginPage({
    searchParams,
}:{
    searchParams: Promise<{ error?: string}>;
}){
    const { error } = await searchParams;
    return(
        <main>
            <h1>Connexion</h1>
            {error && <p>Identifiants incorrects</p>}
            <form action={login}>
                <input type="text" name="email" placeholder="Email"></input>
                <input type="password" name="password" placeholder="Mot de passe"></input>
                <button type="submit">Se connecter</button>
            </form>
        </main>
    )
}