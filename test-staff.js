const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/staff',
  method: 'GET',
  headers: {
    'RSC': '1'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", res.headers);
    console.log("Body:", data.slice(0, 1000));
  });
});
req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
