import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt,
  ScryptOptions,
  timingSafeEqual,
} from 'node:crypto';

/*
 * promisify picks the callback overload without options, so the derivation
 * is wrapped by hand to keep the tuning parameters.
 */
const scryptAsync = (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

/*
 * scrypt from the Node standard library: a memory-hard KDF that needs no
 * third-party dependency and no native build step (which is what makes
 * bcrypt awkward on Alpine images).
 *
 * Parameters are stored alongside each hash so they can be raised later
 * without invalidating existing passwords.
 */
const PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
};

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);

    const derived = await scryptAsync(password, salt, KEY_LENGTH, {
      N: PARAMS.N,
      r: PARAMS.r,
      p: PARAMS.p,
    });

    return [
      'scrypt',
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('hex'),
      derived.toString('hex'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');

    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const [, n, r, p, saltHex, hashHex] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');

    const derived = await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    /*
     * Constant-time comparison: a length mismatch is rejected before
     * timingSafeEqual, which throws on differing lengths.
     */
    if (derived.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(derived, expected);
  }
}
