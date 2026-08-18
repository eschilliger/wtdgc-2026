import { getAuth } from "firebase-admin/auth";
import { db } from "../src/server/firebase/admin";

type Role = "admin" | "staff" | "player";

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const email = readArg("email")?.trim().toLowerCase();
  const role = readArg("role") as Role | null;

  if (!email) throw new Error("Missing --email=<address>.");
  if (role !== "admin" && role !== "staff" && role !== "player") throw new Error("--role must be admin, staff or player.");

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const existingClaims = user.customClaims ?? {};

  await auth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    role,
  });

  await db.collection("appUsers").doc(user.uid).set({
    uid: user.uid,
    email,
    role,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`Role '${role}' assigned to ${email} (${user.uid}).`);
  console.log("The user must refresh/re-authenticate for the new custom claim to appear in their ID token.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
