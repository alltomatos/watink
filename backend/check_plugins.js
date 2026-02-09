
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Config from .env or hardcoded based on what we saw
const secret = process.env.JWT_SECRET || "3123123213123";
const port = process.env.PORT || 8080;

const payload = {
  id: 1,
  username: "admin",
  profile: "admin",
  tenantId: "550e8400-e29b-41d4-a716-446655440000",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
};

const token = jwt.sign(payload, secret);

console.log("Generated Token:", token);

async function checkPlugins() {
  try {
    const url = `http://localhost:${port}/plugins/api/v1/plugins/installed`;
    console.log("Requesting:", url);
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

checkPlugins();
