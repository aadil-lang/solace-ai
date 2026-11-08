// Test mobile API client communication against live backend
const http = require('http');

async function testFetch(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function run() {
  console.log('Testing Mobile-to-Backend Client integration...');
  try {
    const result = await testFetch('http://127.0.0.1:8000/health');
    console.log('Status code:', result.status);
    console.log('Response body:', JSON.stringify(result.data, null, 2));

    if (result.status === 200 && result.data.status === 'healthy' && result.data.service === 'solace-api') {
      console.log('CLIENT INTEGRATION TEST PASSED: Mobile client contract verified.');
      process.exit(0);
    } else {
      console.error('CLIENT INTEGRATION TEST FAILED: Unexpected response format.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error connecting to backend:', err.message);
    process.exit(1);
  }
}

run();

