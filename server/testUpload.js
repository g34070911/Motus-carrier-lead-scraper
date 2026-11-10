const fs = require('fs');
const http = require('http');

async function testUpload() {
  const loginData = JSON.stringify({ email: 'admin@motus.com', password: 'admin123' });
  const loginRes = await new Promise(resolve => {
    const req = http.request('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.write(loginData);
    req.end();
  });

  console.log('Logged in as:', loginRes.user.name);
  const token = loginRes.token;

  const fileBuf = fs.readFileSync('server/uploads/1791077518504_REGISTER20260915.pdf');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

  const part1 = `--${boundary}\r\nContent-Disposition: form-data; name="associated_date"\r\n\r\n09/15/2026\r\n--${boundary}\r\nContent-Disposition: form-data; name="pdf"; filename="REGISTER20260915.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const part2 = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([Buffer.from(part1), fileBuf, Buffer.from(part2)]);

  const uploadRes = await new Promise(resolve => {
    const req = http.request('http://localhost:5000/api/admin/upload-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': payload.length,
        'Authorization': 'Bearer ' + token
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.write(payload);
    req.end();
  });

  console.log('Upload Result:', uploadRes.message);
  console.log('Total Extracted:', uploadRes.totalExtracted);
  console.log('Total Scraped:', uploadRes.totalScraped);
}

testUpload();
