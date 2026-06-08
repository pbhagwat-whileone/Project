import { generateCerebras } from "../src/ai/providers/cerebras";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  try {
    const res = await generateCerebras("Write a test email.", "gpt-oss-120b", true);
    console.log("Success:", res);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();
