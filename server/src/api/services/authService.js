import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

import * as userRepo from '../../database/repositories/userRepo.js';
import {
  emailTaken,
  invalidCredentials,
} from '../errors.js';

const scrypt = promisify(scryptCallback);

const TOKEN_LIFETIME = '8h';
const KEY_LENGTH = 64;

// Passwords are stored as salt:hash. Never store or return plaintext passwords.
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, keyHex] = storedHash.split(':');

  if (!salt || !keyHex || !/^[a-f0-9]+$/i.test(keyHex)) {
    return false;
  }

  const expected = Buffer.from(keyHex, 'hex');

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return timingSafeEqual(expected, derivedKey);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone ?? null,
    role: user.role,
  };
}

function getTokenSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET must be configured.');
  }

  return secret;
}

function createToken(user) {
  return jwt.sign(
    {
      role: user.role,
    },
    getTokenSecret(),
    {
      subject: user.id,
      expiresIn: TOKEN_LIFETIME,
    }
  );
}

export async function register(input) {
  const existingUser = userRepo.findByEmail(input.email);

  if (existingUser) {
    throw emailTaken();
  }

  const passwordHash = await hashPassword(input.password);

  // Always register ordinary users. Admin accounts must be provisioned
  // separately; a client must never choose its own role.
  const user = userRepo.insert({
    name: input.name,
    dob: input.dob,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash,
    role: 'user',
  });

  return {
    user: publicUser(user),
  };
}

export async function login(input) {
  const user = userRepo.findByEmail(input.email);

  // Use the same error for an unknown email and an incorrect password.
  if (
    !user ||
    typeof user.passwordHash !== 'string' ||
    !(await verifyPassword(input.password, user.passwordHash))
  ) {
    throw invalidCredentials();
  }

  return {
    token: createToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export function getCurrentUser(userId) {
  const user = userRepo.findById(userId);

  if (!user) {
    throw invalidCredentials();
  }

  return {
    user: publicUser(user),
  };
}

export async function changePassword(userId, password) {
  const user = userRepo.findById(userId);

  if (!user) {
    throw invalidCredentials();
  }

  const passwordHash = await hashPassword(password);

  userRepo.update(userId, { passwordHash });
}