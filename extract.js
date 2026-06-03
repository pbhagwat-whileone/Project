const fs = require("fs");

const logPath = "C:\\Users\\pbhagwat_whileone\\.gemini\\antigravity-ide\\brain\\f327e115-d82d-43b9-92a7-aff491029744\\.system_generated\\logs\\transcript.jsonl";
const lines = fs.readFileSync(logPath, "utf-8").split("\n");

let filesFound = {};

for (const line of lines) {
  if (!line) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === "TOOL_RESPONSE" && data.tool_calls) {
      for (const call of data.tool_calls) {
        if (call.name === "default_api:view_file" && call.output) {
          if (call.output.includes("validators.ts")) {
            filesFound["validators.ts"] = call.output;
          }
          if (call.output.includes("settings-view.tsx")) {
            filesFound["settings-view.tsx"] = call.output;
          }
          if (call.output.includes("route.ts") && call.output.includes("api\\settings\\route.ts")) {
            filesFound["settings/route.ts"] = call.output;
          }
        }
      }
    }
  } catch(e) {}
}

fs.writeFileSync("extracted_files.json", JSON.stringify(filesFound, null, 2));
console.log(Object.keys(filesFound));
