# Writeup — Helpdesk vulnérable

Application de helpdesk (gestion de tickets d'assistance) construite
**volontairement vulnérable**, pour s'entraîner à repérer, exploiter et corriger
les failles les plus courantes du Top 10 de l'OWASP.

> ⚠️ Cette application contient des failles de sécurité intentionnelles.
> Elle est destinée à un usage **local et éducatif uniquement** et ne doit
> **jamais** être déployée en ligne.

**Stack :** Next.js 16 (App Router), TypeScript, Prisma, SQLite.

**Comptes de test :**

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | `admin@helpdesk.local` | `admin123` |
| Utilisateur | `alice@helpdesk.local` | `alice123` |
| Utilisateur | `bob@helpdesk.local` | `bob123` |

**Failles documentées :**

| # | Faille | Catégorie OWASP Top 10 (2021) |
|---|--------|-------------------------------|
| 1 | Injection SQL — connexion | A03 — Injection |
| 2 | Session faible | A07 — Identification and Authentication Failures |
| 3 | IDOR (référence directe non sécurisée) | A01 — Broken Access Control |
| 4 | XSS stocké | A03 — Injection |
| 5 | Injection SQL — recherche | A03 — Injection |
| 6 | Contrôle d'accès cassé | A01 — Broken Access Control |
| 7 | Mots de passe en MD5 | A02 — Cryptographic Failures |

---

## 1. Injection SQL — page de connexion

**OWASP :** A03 — Injection
**Fichier :** `app/login/actions.ts`

### Repérer

La requête d'authentification est construite en insérant directement l'email
saisi dans une chaîne SQL, puis exécutée avec `$queryRawUnsafe` :

```ts
const requete = `SELECT * FROM "User" WHERE email = '${email}' AND password = '${hash}'`;
const users = await prisma.$queryRawUnsafe(requete);
```

L'entrée utilisateur n'est ni validée ni échappée. Indice révélateur : saisir une
simple apostrophe `'` dans le champ email déséquilibre les guillemets et provoque
une erreur SQL visible dans le terminal du serveur.

### Exploiter

**Objectif :** se connecter sans connaître aucun mot de passe.

Dans le champ **email**, saisir :

```
' OR 1=1 --
```

La requête envoyée à la base devient :

```sql
SELECT * FROM "User" WHERE email = '' OR 1=1 --' AND password = '...'
```

- `' ` ferme la chaîne de l'email ;
- `OR 1=1` est une condition toujours vraie ;
- `--` transforme le reste de la ligne (la vérification du mot de passe) en
  commentaire SQL, donc ignoré.

La requête renvoie tous les utilisateurs ; le code garde le premier (l'admin) et
pose la session sur son compte. On est connecté en tant qu'admin.

> Remarque : le mot de passe est haché avant d'entrer dans la requête, donc
> l'injection ne peut passer que par le champ email.

![Connexion par injection SQL](docs/images/01-sqli-login.png)

### Corriger

Ne jamais concaténer d'entrée utilisateur dans du SQL. Utiliser une requête
**paramétrée** : avec Prisma, les méthodes de l'ORM (`findFirst`, `findUnique`…)
génèrent automatiquement des requêtes paramétrées, où les valeurs sont traitées
comme des données et jamais comme du code.

```ts
const user = await prisma.user.findFirst({
  where: { email, password: hash },
});
if (!user) {
  redirect("/login?error=1");
}
```

---

## 2. Session faible

**OWASP :** A07 — Identification and Authentication Failures
**Fichier :** `app/login/actions.ts`

### Repérer

Après une connexion réussie, la session est posée dans un simple cookie
contenant l'identifiant brut de l'utilisateur, sans aucune option :

```ts
(await cookies()).set("userId", String(user.id));
```

Deux problèmes :

- la valeur est l'`id` en clair (`2`), **prévisible et modifiable** ;
- le cookie n'a ni `httpOnly`, ni `secure`, ni signature, ni expiration. Rien ne
  garantit qu'il n'a pas été falsifié.

### Exploiter

**Objectif :** usurper l'identité d'un autre utilisateur.

1. Se connecter en tant qu'alice (`userId=2`).
2. Ouvrir les outils de développement → onglet **Stockage** → **Cookies**.
3. Remplacer la valeur de `userId` par `1` (admin) ou `3` (bob).
4. Recharger `/tickets` : on voit désormais les tickets de l'autre utilisateur.

Aucun mot de passe n'est nécessaire : il suffit de deviner un identifiant, et ils
se suivent (1, 2, 3…).

![Falsification du cookie de session](docs/images/02-session-faible.png)

### Corriger

- Stocker un **identifiant de session opaque et aléatoire** (ou un jeton signé,
  type JWT), jamais l'`id` en clair.
- Poser le cookie avec les bonnes options :

```ts
(await cookies()).set("session", token, {
  httpOnly: true,   // inaccessible au JavaScript (voir faille 4)
  secure: true,     // transmis uniquement en HTTPS
  sameSite: "lax",  // limite les requêtes inter-sites
  maxAge: 60 * 60,  // expiration
});
```

- Valider la signature du jeton côté serveur à chaque requête.

---

## 3. IDOR — accès au ticket d'un autre utilisateur

**OWASP :** A01 — Broken Access Control
**Fichier :** `app/tickets/[id]/page.tsx`

### Repérer

La page de détail récupère un ticket par son `id` issu de l'URL, mais ne vérifie
**jamais** que ce ticket appartient à l'utilisateur connecté :

```ts
const userId = (await cookies()).get("userId")?.value;
// ...
const ticket = await prisma.ticket.findUnique({
  where: { id: ticketId },
  include: { author: true, comments: { include: { author: true } } },
});
// Aucune vérification : ticket.authorId === Number(userId) ?
```

### Exploiter

**Objectif :** lire le ticket d'un autre utilisateur.

Connecté en tant qu'alice (dont le ticket est `/tickets/1`), modifier
l'identifiant dans l'URL :

```
http://localhost:3000/tickets/2
```

Le ticket `2` appartient à bob, mais il s'affiche quand même, avec son contenu et
ses commentaires. En incrémentant l'`id`, on peut parcourir tous les tickets de
l'application.

![IDOR — ticket d'un autre utilisateur](docs/images/03-idor.png)

### Corriger

Après avoir récupéré le ticket, vérifier que l'utilisateur connecté en est bien
le propriétaire (ou qu'il est admin), sinon renvoyer une 404 :

```ts
if (!ticket || ticket.authorId !== Number(userId)) {
  notFound();
}
```

Le contrôle d'accès doit toujours se faire **côté serveur**, sur l'objet
réellement demandé.

---

## 4. XSS stocké — commentaires

**OWASP :** A03 — Injection
**Fichier :** `app/tickets/[id]/page.tsx`

### Repérer

Par défaut, React échappe tout texte affiché : écrire `{comment.content}` rend le
contenu inoffensif. Ici, le code force l'insertion du commentaire **en tant que
HTML brut**, via `dangerouslySetInnerHTML` :

```tsx
<span dangerouslySetInnerHTML={{ __html: comment.content }} />
```

Le contenu, saisi par l'utilisateur et stocké en base, est réinjecté sans aucun
filtrage. C'est un XSS **stocké** : la charge se déclenche chez tous ceux qui
affichent le ticket, y compris l'admin.

### Exploiter

**Objectif :** exécuter du JavaScript dans le navigateur de la victime.

Une balise `<script>` injectée via `innerHTML` ne s'exécute pas ; on passe donc
par un gestionnaire d'événement. Poster comme commentaire :

```html
<img src=x onerror=alert(1)>
```

L'image `x` échoue à charger, ce qui déclenche `onerror`, donc `alert(1)`.

**Escalade — vol de session.** Comme le cookie n'a pas l'option `httpOnly`
(faille 2), le JavaScript de la page peut le lire :

```html
<img src=x onerror=alert(document.cookie)>
```

L'alerte affiche `userId=2`. Dans une attaque réelle, on enverrait ce cookie vers
un serveur contrôlé par l'attaquant pour détourner la session de la victime —
typiquement celle de l'admin qui consulte le ticket. C'est une **chaîne de
failles** : XSS stocké + session faible.

![XSS stocké — alert(document.cookie)](docs/images/04-xss.png)

### Corriger

- Ne jamais utiliser `dangerouslySetInnerHTML` avec du contenu utilisateur.
  Laisser React échapper le texte :

```tsx
<span>{comment.content}</span>
```

- Si l'on a vraiment besoin de HTML riche, le nettoyer avec une bibliothèque de
  *sanitization* (ex. DOMPurify) côté serveur.
- Poser le cookie en `httpOnly` (faille 2) pour qu'un éventuel XSS ne puisse pas
  lire la session.

---

## 5. Injection SQL — recherche de tickets

**OWASP :** A03 — Injection
**Fichier :** `app/tickets/page.tsx`

### Repérer

La barre de recherche construit une requête SQL par concaténation, comme le
login :

```ts
const requete = `SELECT * FROM "Ticket" WHERE title LIKE '%${q}%'`;
tickets = await prisma.$queryRawUnsafe(requete);
```

Faille supplémentaire : en mode recherche, le filtre `authorId` disparaît — la
requête ramène les tickets de **tout le monde**, pas seulement ceux de
l'utilisateur.

### Exploiter

**Objectif :** afficher tous les tickets de la base.

Dans la barre de recherche, saisir :

```
' OR '1'='1
```

La requête devient :

```sql
SELECT * FROM "Ticket" WHERE title LIKE '%' OR '1'='1%'
```

`LIKE '%'` correspond à tout, et `OR '1'='1'` est toujours vrai : tous les
tickets s'affichent, quel que soit leur auteur. La même erreur (concaténation
d'entrée utilisateur dans du SQL) se retrouve donc à deux endroits de
l'application.

![Injection SQL dans la recherche](docs/images/05-sqli-recherche.png)

### Corriger

Utiliser l'API de l'ORM, qui filtre de façon paramétrée, et conserver la
restriction sur le propriétaire :

```ts
const tickets = await prisma.ticket.findMany({
  where: {
    authorId: Number(userId),
    title: { contains: q ?? "" },
  },
});
```

---

## 6. Contrôle d'accès cassé — page admin

**OWASP :** A01 — Broken Access Control
**Fichier :** `app/admin/page.tsx`

### Repérer

La page d'administration vérifie seulement qu'un utilisateur est **connecté**,
jamais qu'il est **administrateur** :

```ts
const userId = (await cookies()).get("userId")?.value;
if (!userId) {
  redirect("/login");
}
// Aucune vérification du rôle : on ne teste pas user.role === "ADMIN"
const users = await prisma.user.findMany();
```

### Exploiter

**Objectif :** accéder à une fonction réservée à l'admin en tant que simple
utilisateur.

Connecté en tant qu'alice (rôle `USER`), ouvrir directement :

```
http://localhost:3000/admin
```

La page affiche la liste de **tous** les comptes, avec leurs rôles et leurs hash
de mots de passe. Aucune redirection, aucun blocage.

![Accès à la page admin sans être admin](docs/images/06-admin.png)

### Corriger

Contrôler le rôle côté serveur, à partir de la base (jamais à partir du seul
cookie, falsifiable) :

```ts
const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
if (!user || user.role !== "ADMIN") {
  notFound(); // ou redirect("/login")
}
```

Idéalement, centraliser ce contrôle dans une couche d'accès aux données (DAL) ou
un middleware, pour ne pas l'oublier sur une page.

---

## 7. Mots de passe hachés en MD5

**OWASP :** A02 — Cryptographic Failures
**Fichier :** `prisma/seed.ts`

### Repérer

Les mots de passe sont hachés avec MD5, sans sel :

```ts
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
```

MD5 est inadapté au stockage de mots de passe :

- **trop rapide** : un GPU calcule des milliards de hash par seconde, donc des
  milliards de tentatives ;
- **sans sel** : deux mots de passe identiques donnent le même hash ;
- **déjà cassé** : les hash des mots de passe courants sont dans des bases
  publiques (rainbow tables).

### Exploiter

**Objectif :** retrouver un mot de passe en clair à partir de son hash (obtenu
via la faille 6).

Le hash de l'admin, `0192023a7bbd73250516f069df18b500`, collé dans un service en
ligne comme [CrackStation](https://crackstation.net), est retrouvé
instantanément : **`admin123`**.

![Hash MD5 cassé avec CrackStation](docs/images/07-md5.png)

### Corriger

Utiliser une fonction de hachage **lente et salée**, conçue pour les mots de
passe : bcrypt, scrypt ou Argon2.

```ts
import bcrypt from "bcrypt";

// À l'inscription
const hash = await bcrypt.hash(password, 12);

// À la connexion
const ok = await bcrypt.compare(password, user.password);
```

Chaque hash intègre son propre sel, et le coût (ici `12`) rend les attaques par
force brute bien plus lentes.

---

## Récapitulatif des corrections

| Faille | Principe de la correction |
|--------|---------------------------|
| Injection SQL (×2) | Requêtes paramétrées via l'ORM, jamais de concaténation |
| Session faible | Jeton opaque/signé + cookie `httpOnly`, `secure`, `sameSite`, expiration |
| IDOR | Vérifier la propriété de l'objet côté serveur |
| XSS stocké | Échapper le contenu (pas de `dangerouslySetInnerHTML`) + `httpOnly` |
| Contrôle d'accès | Vérifier le rôle en base, idéalement dans une couche centralisée |
| MD5 | Hachage lent et salé (bcrypt / Argon2) |

Les correctifs sont implémentés sur la branche `fixed`.
