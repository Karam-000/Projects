const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        console.log('\n--- New Notification Received ---');
        console.log('Timestamp:', new Date().toISOString());
        console.log('HTTP Method:', req.method);
        console.log('URL Path:', req.url);
        
        // Log headers
        console.log('\nHeaders:');
        console.log('---------');
        Object.entries(req.headers).forEach(([key, value]) => {
          console.log(`${key}: ${value}`);
        });

        // Parse and log body
        const parsedBody = JSON.parse(body);
        console.log('\nParsed Body:', parsedBody);
        console.log('------------');
        
        if (req.url === '/add-product') {
          // Product notification format
          console.log('Process ID:', parsedBody.processId);
          console.log('Process Type:', parsedBody.processType);
          console.log('Description:', parsedBody.description);
          console.log('Product:', parsedBody.product);
          console.log('Shelf:', parsedBody.shelf);
          console.log('Branch ID:', parsedBody.branchId);
          console.log('Assigned Time:', parsedBody.assignedTime);
        } else if (req.url === '/prepare-delivery') {
          // Order notification format
          console.log('Order ID:', parsedBody.orderId);
          console.log('Order Type:', parsedBody);
          parsedBody.items.forEach((task, index) => {
            console.log(`\nTask ${index + 1}:`);
            console.log('Process ID:', task.processId);
            console.log('Process Type:', task.processType);
            console.log('Description:', task.description);
            console.log('Product:', task.product);
            console.log('Shelf:', task.shelf);
            console.log('Branch ID:', task.branchId);
            console.log('Assigned Time:', task.assignedTime);
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));

      } catch (err) {
        console.error('Error processing request:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3001, () => {
  console.log('Test server running on port 3001');
});