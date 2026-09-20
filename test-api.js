const fetch = require('node-fetch') || fetch; // Use global fetch in Node 18+

async function testApi() {
    console.log("Testing POST /api/tools/process");
    const res = await fetch('https://academia-iw7x.onrender.com/api/tools/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' })
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
}

testApi();
