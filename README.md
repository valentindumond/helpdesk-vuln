# helpdesk-vuln

Application web de **helpdesk** (gestion de tickets d'assistance) développée à but
pédagogique, en deux versions :

- 🔓 **vulnérable** : 6 failles classiques de l'OWASP Top 10 introduites volontairement ;
- 🔒 **corrigée** (branche `fixed`) : les mêmes fonctionnalités, chaque faille réparée.

L'objectif est de pratiquer la sécurité web **des deux côtés** : attaquer, puis défendre.
Chaque faille est analysée dans le [writeup](WRITEUP.md) selon le même plan :
**repérer → exploiter → corriger**.

> ⚠️ Cette application contient des failles intentionnelles.
> À utiliser **uniquement en local**. Ne jamais la déployer en ligne.

## Failles couvertes

| Faille | OWASP Top 10 |
|--------|--------------|
| Injection SQL (connexion et recherche) | A03 — Injection |
| XSS stocké | A03 — Injection |
| IDOR | A01 — Broken Access Control |
| Contrôle d'accès cassé (page admin) | A01 — Broken Access Control |
| Session faible | A07 — Authentication Failures |
| Mots de passe en MD5 | A02 — Cryptographic Failures |

## Stack

Next.js 16 (App Router) · TypeScript · Prisma · SQLite

## Lancer en local

```bash
npm install
npx prisma migrate dev
npm run seed      # comptes de test : alice / bob / admin
npm run dev