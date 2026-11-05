import jwt from 'jsonwebtoken';

// npm run token [-- user]
//
// Prints a bearer token for trying the API by hand (curl, Postman), since
// sign-in is not part of this branch. It is signed with the same development
// secret src/index.js falls back to, so set JWT_SECRET the same way for both.
//
//   curl -H "Authorization: Bearer <token>" http://localhost:4000/stats

const role = process.argv[2] === 'user' ? 'user' : 'admin';
const secret = process.env.JWT_SECRET ?? 'queuesmart-dev-secret-change-me';

console.log(jwt.sign({ sub: `u-${role}`, role }, secret, { expiresIn: '8h' }));
