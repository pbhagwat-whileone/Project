const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: envPath });

async function testApollo() {
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) {
    console.error("Missing APOLLO_API_KEY");
    return;
  }

  const payload = {
    linkedin_url: "https://www.linkedin.com/in/rajeevgadgil"
  };

  const endpoint = "https://api.apollo.io/v1/people/match";
  console.log("Payload:", payload);
  console.log("Endpoint:", endpoint);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloKey
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.log("Status:", response.status);
      console.log("Error Body:", errorBody);
    } else {
      const data = await response.json();
      console.log("Success:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testApollo();
