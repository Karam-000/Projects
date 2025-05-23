// testRoutes.js
const BASE_URL = 'http://localhost:3000/users';

async function main() {
    // Dynamically import node-fetch
    const fetch = (await import('node-fetch')).default;
    
    // Replace this with a valid token
    const validToken = process.env.TEST_VALID_TOKEN || 'REPLACE_WITH_VALID_TOKEN'; 

    // Test the endpoints
    // await testGetProducts(fetch, validToken);
    // await testSearchProduct(fetch, validToken, 'laptop');
    await testAddProductToCart(fetch, validToken,8,2); // Example: Add product with ID 1 to cart with quantity 2
}

async function testGetProducts(fetch, token) {
    try {
        const response = await fetch(`${BASE_URL}/products`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`);
        }

        const data = await response.json();
        console.log('Product Inventory:', data);
        return data;
    } catch (error) {
        console.error('Error fetching products:', error.message);
    }
}

async function testSearchProduct(fetch, token, searchTerm) {
    try {
        const response = await fetch(`${BASE_URL}/searchProduct?q=${encodeURIComponent(searchTerm)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`);
        }

        const data = await response.json();
        console.log('Search Results:', data);
        return data;
    } catch (error) {
        console.error('Error searching products:', error.message);
    }
}


// Run the tests
//main().catch(console.error);

function addToCart(inventoryId, quantity, token) {
    fetch('http://localhost:3000/users/addToCart', {  // Replace with your server's URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,  // Include the authorization token
      },
      body: JSON.stringify({ inventoryId, quantity })  // Send the inventoryId and quantity in the request body
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
      console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
      console.error('Error:', error);  // Handle any errors
    });
  }
  function testdecrementCart(inventory,token) {
    fetch('http://localhost:3000/users/decrementCart', {  // Replace with your server's URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,  // Include the authorization token
      },
      body: JSON.stringify({ inventoryId })  // Send the inventoryId and quantity in the request body
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
      console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
      console.error('Error:', error);  // Handle any errors
    });
  }
  function testRemovefromcart(inventoryId,token) {
    fetch('http://localhost:3000/users/removeCart', {  // Replace with your server's URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,  // Include the authorization token
      },
      body: JSON.stringify({ inventoryId })  // Send the inventoryId and quantity in the request body
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
      console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
      console.error('Error:', error);  // Handle any errors
    });
  }

  function testGetcaeritems(token)
  {
    fetch('http://localhost:3000/users//cart', {  // Replace with your
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,  // Include the authorization token
        },
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
        console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
        console.error('Error:', error);  // Handle any errors
    });
    }

  // Example usage:
  const inventoryId = 8;
  const quantity = 2;
  const token = process.env.TEST_TOKEN || 'REPLACE_WITH_VALID_TOKEN';  // Replace with the actual token
  
//addToCart(inventoryId, quantity, token);
//testdecrementCart(inventoryId,token);
//testRemovefromcart(inventoryId,token);
//testGetcaeritems(token);
function testResetPasword(username)
{
    fetch('http://localhost:3000/auth/ResetPassword', {  // Replace with your server's URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })  // Send the inventoryId and quantity in the request body
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
      console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
      console.error('Error:', error);  // Handle any errors
    });
  }
 // testResetPasword('karamm')
function testGetcustomerinfo(token){
    fetch('http://localhost:3000/users//getCustomerInfo', {  // Replace with your
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,  // Include the authorization token
        },
    })
    .then(response => response.json())  // Parse the response as JSON
    .then(data => {
        console.log('Response:', data);  // Log the response data
    })
    .catch(error => {
        console.error('Error:', error);  // Handle any errors
    });
    }
    //testGetcustomerinfo(process.env.TEST_TOKEN || 'REPLACE_WITH_VALID_TOKEN');
    async function testUpdateCustomer(token, customerId) {
        try {
          const response = await fetch('http://localhost:3000/users/updateCustomerInfo', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              CustomerID: customerId,
              Email: 'new.email@example.com',
              PhoneNumber: '555-1234',
              
            })
          });
      
          const data = await response.json();
          console.log('Status:', response.status);
          console.log('Response:', data);
          
          if (response.ok) {
            console.log('Update successful!');
          } else {
            console.error('Update failed:', data.message);
          }
      
        } catch (error) {
          console.error('Request failed:', error);
        }
      }
      
      // // Usage example
      // const testToken2 = process.env.TEST_TOKEN || 'REPLACE_WITH_VALID_TOKEN';
      // const testCustomerId = 42;
      //testUpdateCustomer(testToken2, testCustomerId);

      async function testAccountDeletion(token, password) {
        try {
          const response = await fetch('http://localhost:3000/users/delete-account', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
          });
      
          const data = await response.json();
          console.log('Status:', response.status);
          console.log('Response:', data);
          
          if (response.ok) {
            console.log('Account deleted successfully');
          } else {
            console.error('Deletion failed:', data.message);
          }
      
        } catch (error) {
          console.error('Request failed:', error);
        }
      }
      
      // Usage example
      //testAccountDeletion(testToken2, 'REPLACE_WITH_PASSWORD');

      // Payment Routes Tests
async function testAddPayment(token) {
    try {
      const response = await fetch('http://localhost:3000/users/add-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentDetails: {
            cardNumber: '4111-1111-1111-1111',
            expiry: '12/25',
            cvv: '123',
            cardHolder: 'Test User'
          }
        })
      });
      
      console.log('Add Payment Status:', response.status);
      console.log('Add Payment Response:', await response.json());
    } catch (error) {
      console.error('Add Payment Failed:', error);
    }
  }
  
  async function testUpdatePayment(token, paymentId) {
    try {
      const response = await fetch('http://localhost:3000/users/update-payment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentId,
          updates: {
            expiry: '12/26',
            cardHolder: 'Updated Name'
          }
        })
      });
      
      console.log('Update Payment Status:', response.status);
      console.log('Update Payment Response:', await response.json());
    } catch (error) {
      console.error('Update Payment Failed:', error);
    }
  }
  
  async function testDeletePayment(token, paymentId) {
    try {
      const response = await fetch('http://localhost:3000/users/delete-payment', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paymentId })
      });
      
      console.log('Delete Payment Status:', response.status);
      console.log('Delete Payment Response:', await response.json());
    } catch (error) {
      console.error('Delete Payment Failed:', error);
    }
  }
  
  async function testGetPayments(token) {
    try {
      const response = await fetch('http://localhost:3000/users/get-payment', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Get Payments Status:', response.status);
      console.log('Get Payments Response:', await response.json());
    } catch (error) {
      console.error('Get Payments Failed:', error);
    }
  }
  
  // Delivery Location Tests
  async function testAddDeliveryLocation(token) {
    try {
      const response = await fetch('http://localhost:3000/users/add-delivery-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location: {
            Address: '123 Test St',
            City: 'Test City',
            State: 'TS',
            ZipCode: '12345'
           
          }
        })
      });
      
      console.log('Add Location Status:', response.status);
      console.log('Add Location Response:', await response.json());
    } catch (error) {
      console.error('Add Location Failed:', error);
    }
  }
  
  async function testUpdateDeliveryLocation(token, locationId) {
    try {
      const response = await fetch('http://localhost:3000/users/update-delivery-location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryLocationID: locationId,
          updates: {
            label: 'Work',
            zip: '54321'
          }
        })
      });
      
      console.log('Update Location Status:', response.status);
      console.log('Update Location Response:', await response.json());
    } catch (error) {
      console.error('Update Location Failed:', error);
    }
  }
  
  async function testDeleteDeliveryLocation(token, locationId) {
    try {
      const response = await fetch('http://localhost:3000/users/delete-delivery-location', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deliveryLocationID: locationId })
      });
      
      console.log('Delete Location Status:', response.status);
      console.log('Delete Location Response:', await response.json());
    } catch (error) {
      console.error('Delete Location Failed:', error);
    }
  }
  
  async function testGetDeliveryLocations(token) {
    try {
      const response = await fetch('http://localhost:3000/users/get-delivery-locations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Get Locations Status:', response.status);
      console.log('Get Locations Response:', await response.json());
    } catch (error) {
      console.error('Get Locations Failed:', error);
    }
  }
  
  // Example usage:
const testToken2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyLCJ1c2VybmFtZSI6IkthcmFtbSIsImlhdCI6MTc0MzY5NjM5MiwiZXhwIjoxNzQzNjk5OTkyfQ.YOihFCKYM1MB945xFSoRapEsk_4kbGwO1gaAPv4oKCU';
//testAddPayment(testToken2);
//testAddDeliveryLocation(testToken2);

async function testUpdateEmployee(token, employeeId, updates) {
    try {
      const response = await fetch('http://localhost:3000/employee/UpdateEmployee', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include admin token
        },
        body: JSON.stringify({
          Updateid: employeeId,
          Updates: updates
        })
      });
      
      console.log('Update Status:', response.status);
      console.log('Update Response:', await response.json());
    } catch (error) {
      console.error('Update Failed:', error);
    }
  }

// Example usage:
// 1. Successful update
testUpdateEmployee('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJEZXBhcnRtZW50TmFtZSI6IkhSIiwiZW1wbG95ZWVJZCI6MSwiZW1wbG95ZWVOYW1lIjoiIEthcmFtIEFib3UgU2FoeW91biIsImlhdCI6MTc0MzcwMjgyNiwiZXhwIjoxNzQzNzA2NDI2fQ.kiCgs6oUTpXUi0babs-cQmGlXER7KGo0vo5MlnKuOv8', 1, 
    {
        "salary": 75000,
        "DepartmentID": 1,
        "Address": "123 New St, Cityville",
        "Phone": "555-5678"
      
});

// // 2. Test missing parameters (should return 400)
// testUpdateEmployee('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJEZXBhcnRtZW50TmFtZSI6IkhSIiwiZW1wbG95ZWVJZCI6MSwiZW1wbG95ZWVOYW1lIjoiIEthcmFtIEFib3UgU2FoeW91biIsImlhdCI6MTc0MzY5ODY1MCwiZXhwIjoxNzQzNzAyMjUwfQ.4I2vAz3qEg0GaVVsrtP4JXL4x0i1iLkBSNG7G-sEI7w', null, {}); 

// // 3. Test invalid employee ID (should return 200 but shows logical flaw)
// testUpdateEmployee('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJEZXBhcnRtZW50TmFtZSI6IkhSIiwiZW1wbG95ZWVJZCI6MSwiZW1wbG95ZWVOYW1lIjoiIEthcmFtIEFib3UgU2FoeW91biIsImlhdCI6MTc0MzY5ODY1MCwiZXhwIjoxNzQzNzAyMjUwfQ.4I2vAz3qEg0GaVVsrtP4JXL4x0i1iLkBSNG7G-sEI7w', 'INVALID-ID', { role: 'Manager' });