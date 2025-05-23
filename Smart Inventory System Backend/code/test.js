const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

function testDamagedRoute() {
    const form = new FormData();
    
    // Attach an image file (Replace 'test-image.jpg' with an actual file path)
    form.append('image', fs.createReadStream("C:\\Users\\karam\\OneDrive\\Documents\\Desktop\\hafez.jpeg"));
    form.append('description', 'Damaged product due to shipping error');
    form.append('inventoryId', '12345');
    form.append('branchId', '6789');
    //http://192.168.56.1:3000
    const options = {
        //hostname: '192.168.241.8:5000',
        hostname: '192.168.56.1:5000',
        port: 5000,
        path: '/refund/damaged',
        method: 'POST',
        headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Server Response:', data);
        });
    });

    req.on('error', (error) => {
        console.error('Request Error:', error);
    });

    form.pipe(req);
}
testDamagedRoute();
async function fetchCustomerOrders() {
    try {
        const response = await fetch('http://localhost:3000/users/Orders/History', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyLCJ1c2VybmFtZSI6IkthcmFtbSIsImlhdCI6MTc0NTkyOTkyOSwiZXhwIjoxNzQ1OTMzNTI5fQ.HVEHEXjcS85uQkw3hZtGW2scuiXZhFZ26TtCSI5Wpk0'

            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error fetching orders:', errorData.message || 'Unknown error');
            return;
        }

        const result = await response.json();
        console.log('Customer Orders:', result.data);

        result.data.forEach(order => {
            console.log(`Order ID: ${order.OrderID}`);
            console.log(`Branch ID: ${order.BranchID}`);
            console.log(`Order Date: ${order.OrderDate}`);
            console.log(`Total Amount: ${order.TotalAmount}`);
            console.log(`Status: ${order.Status}`);
            console.log(`Products: ${order.Products}`);
            console.log('---------------------------');
        });

    } catch (error) {
        console.error('Network or server error:', error.message || error);
    }
}
//fetchCustomerOrders();