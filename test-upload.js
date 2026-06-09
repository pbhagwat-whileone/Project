const fs = require('fs');

async function run() {
  const form = new FormData();
  form.append('connection_owner_name', 'Test Owner');
  
  const csvContent = `First Name,Last Name,Company,Position,Email Address,Profile URL,Connected On
John,Doe,Google,Engineer,john@google.com,https://linkedin.com/in/johndoe,2021-01-01`;
  
  const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
  form.append('file', file);
  
  try {
    const res = await fetch('http://localhost:3000/api/connections/upload', {
      method: 'POST',
      body: form
    });
    
    console.log("STATUS:", res.status);
    const text = await res.text();
    console.log("BODY:", text);
  } catch (e) {
    console.error("FETCH ERROR:", e);
  }
}

run();
