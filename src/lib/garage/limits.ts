/**
 * Garage limits the browser needs to know.
 *
 * This file must stay free of imports. It exists because the vehicle selector and the
 * in-use vehicle chip — both `"use client"` — read `GARAGE_MAX_VEHICLES`, and used to read
 * it from `./cookie`. That module imports `./signature`, which imports Node's `crypto`, so
 * the bundler shipped the whole `crypto-browserify` polyfill (secp256k1, pbkdf2 and
 * friends: a 430 KB chunk, ~126 KB on the wire) to every page, to deliver the number 3.
 * `./signature` is now `server-only`, so the same mistake fails the build instead.
 */

/** v1 stores three. A limit the UI enforces visibly, never by silently dropping. */
export const GARAGE_MAX_VEHICLES = 3;
