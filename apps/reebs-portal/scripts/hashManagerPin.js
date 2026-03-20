/* eslint-disable no-undef */
import { hashPassword } from "../utils/passwords.js";

const pin = process.argv[2] || "";
if (!/^\d{6}$/.test(pin)) {
  console.error("Usage: node scripts/hashManagerPin.js 123456");
  process.exit(1);
}

const main = async () => {
  try {
    const hashed = await hashPassword(pin);
    console.log(hashed);
  } catch (err) {
    console.error("Failed to hash PIN:", err?.message || err);
    process.exit(1);
  }
};

main();
