#!/usr/bin/env node
/**
 * generate-dev-cert.js
 * Generate auto-signeds certs (localhost)
 * Output:
 *   ./certs/fullchain.pem
 *   ./certs/privkey.pem
 */

import fs from "fs";
import path from "path";
import selfsigned from "selfsigned";

const CERT_DIR = path.resolve("./nginx/certs");
const FULLCHAIN_PATH = path.join(CERT_DIR, "fullchain.pem");
const PRIVKEY_PATH = path.join(CERT_DIR, "privkey.pem");

if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  console.log(`[certs] folder created: ${CERT_DIR}`);
}

console.log("[certs] generating auto-signeds certs for localhost...");

const attrs = [{ name: "commonName", value: "localhost" }];
const options = {
  keySize: 2048,
  days: 365,
  algorithm: "sha256",
  extensions: [
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" }, // DNS
        { type: 7, ip: "127.0.0.1" }, // IPv4
        { type: 7, ip: "::1" }, // IPv6
      ],
    },
  ],
};

const cert = selfsigned.generate(attrs, options);

fs.writeFileSync(FULLCHAIN_PATH, cert.cert);
fs.writeFileSync(PRIVKEY_PATH, cert.private);

console.log(`[certs] certs generated with success`);
console.log(`[certs] fullchain.pem -> ${FULLCHAIN_PATH}`);
console.log(`[certs] privkey.pem   -> ${PRIVKEY_PATH}`);
