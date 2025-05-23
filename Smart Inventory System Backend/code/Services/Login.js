const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('../Database/db');
const jwt = require('jsonwebtoken');
const sendEmail = require('./email');
const crypto=require("crypto");
const { each } = require('async');
//===================================================================================================
async function encryptPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}
async function testEncryptPassword() {
    const password = "karam.1234";
    const hashedPassword = await encryptPassword(password);
    console.log(`Original Password: ${password}`);
    console.log(`Encrypted Password: ${hashedPassword}`);
    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log(`Password Match: ${isMatch}`);
}
//testEncryptPassword();

//===================================================================================================
async function loginUser(username, password) {
    try {
        console.log(`Attempting to log in user: ${username}`);

        const pool = await poolPromise;
        console.log('Connected to SQL database');

        const request = new sql.Request(pool);

        // Input parameters for SQL query
        request.input('Username', sql.NVarChar, username);
        console.log(`Username parameter set to: ${username}`);

        // Execute query to fetch user details
        const result = await request.query(`
            SELECT CustomerID, Username, PasswordHash
            FROM Customers
            WHERE Username = @Username And IsDeleted=0;
        `);
        console.log('Query executed successfully');

        // Check if user exists
        if (result.recordset.length === 0) {
            console.log('User not found');
            return { success: false, message: 'User not found' };
        }

        const user = result.recordset[0];
        console.log(`User found: ${user.Username}`);

        // Verify password hash
        console.log(`Verifying password for user: ${user.PasswordHash}`);
        const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!passwordMatch) {
            console.log('Incorrect password');
            return { success: false, message: 'Incorrect password' };
        }
        console.log('Password verified successfully');

        // Generate JWT token for the current login session
        const token = generateToken(user.CustomerID, user.Username);
        console.log('JWT token generated');

        // Store username and token in a database table
        await storeSession(username, token);
        console.log('Session stored in database');

        return { success: true, user, token };
    } catch (err) {
        console.error('Error during login process:', err.message);
        return { success: false, message: 'Internal server error' };
    }
}

async function testLogin() {
    try {
        const test = await loginUser('Karamm', 'karam.1234');
        console.log(test); // Log the response from loginUser
    } catch (error) {
        console.error('Error during login:', error.message);
    }
}

// // Call the async function
//testLogin();

async function verifyPassword(username, password) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('Username', sql.VarChar, username)
        .query('SELECT PasswordHash FROM Customers WHERE username = @Username And IsDeleted=0');

    if (result.recordset.length === 0) {
        throw new Error('User not found');
    }

    const user = result.recordset[0];
    return bcrypt.compare(password, user.PasswordHash);
}
//verifyPassword('user5', 'karam')
//===================================================================================================

async function storeSession(username, token) {
    try {
        const pool = await poolPromise;
        const request = new sql.Request(pool);

        // Input parameters for SQL query
        request.input('Username', sql.NVarChar, username);
        request.input('Token', sql.NVarChar, token);

        // Execute SQL query to insert username and token into UserSessions table
        await request.query(`
            INSERT INTO UserSessions (Username, Token)
            VALUES (@Username, @Token);
        `);

        console.log('Session stored in database');
    } catch (error) {
        console.error('Error storing session:', error.message);
        throw error;
    }
}
//===================================================================================================
function generateToken(userId, username) {
    const tokenPayload = { userId, username };
    const token = jwt.sign(tokenPayload, '0000', { expiresIn: '1h' });
    console.log(`JWT token created: ${token}`);
    return token;
}
//===================================================================================================



async function getCustomerInfoFromToken(token) {
    try {
        // Verify and decode the token
       // const decodedToken = jwt.verify(token, '0000'); // Replace with your actual secret key
        //const customerId = decodedToken.userId;
         const customerId=1;
        // Get database connection
        const pool = await poolPromise;

        // Fetch customer info
        const customerResult = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT CustomerID, Username, FirstName, LastName, Email, Phone 
                FROM Customers 
                WHERE CustomerID = @customerId
            `);

        if (customerResult.recordset.length === 0) {
            throw new Error('Customer not found');
        }

        const customer = customerResult.recordset[0];

        // Fetch orders and order items for the customer
        const ordersResult = await pool.request()
            .input('username', sql.VarChar(50), customer.Username)
            .query(`
                SELECT 
                    o.OrderID, 
                    o.OrderDate, 
                    o.TotalAmount, 
                    o.Status, 
                    oi.ProductID, 
                    oi.Quantity, 
                    oi.UnitPrice, 
                    oi.TotalPrice, 
                    p.ProductName
                FROM Orders o
                JOIN OrderItems oi ON o.OrderID = oi.OrderID
                JOIN Product p ON oi.ProductID = p.ProductID
                WHERE o.Username = @username
            `);

        // Transform flat result into structured orders with items
        const orders = [];
        let currentOrder = null;

        ordersResult.recordset.forEach(item => {
            if (!currentOrder || currentOrder.OrderID !== item.OrderID) {
                if (currentOrder) orders.push(currentOrder);
                currentOrder = {
                    OrderID: item.OrderID,
                    OrderDate: item.OrderDate,
                    TotalAmount: item.TotalAmount,
                    Status: item.Status,
                    Items: []
                };
            }
            currentOrder.Items.push({
                ProductID: item.ProductID,
                ProductName: item.ProductName,
                Quantity: item.Quantity,
                UnitPrice: item.UnitPrice,
                TotalPrice: item.TotalPrice
            });
        });

        if (currentOrder) orders.push(currentOrder);

        // Attach orders to customer object
        customer.orders = orders;

        return customer;

    } catch (error) {
        throw new Error(`Failed to retrieve customer info: ${error.message}`);
    }
}

async function testGetCustomerInfo() {
    try {
        const customer = await getCustomerInfoFromToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoidXNlcjUiLCJpYXQiOjE3MzYxNjIzMjMsImV4cCI6MTczNjE2NTkyM30.gFOjDA2szDfhSvqcjJTN5DV8Tn7phS9-qaG82J0Iz8g');
        
        console.log('--- Customer Details ---');
        console.log(`Customer ID: ${customer.CustomerID}`);
        console.log(`Username: ${customer.Username}`);
        console.log(`Name: ${customer.FirstName} ${customer.LastName}`);
        console.log(`Email: ${customer.Email}`);
        console.log(`Phone: ${customer.Phone}`);
        
        console.log('\n--- Order History ---');
        if (customer.orders && customer.orders.length > 0) {
            customer.orders.forEach((order, index) => {
                console.log(`\nOrder #${index + 1}`);
                console.log(`Order ID: ${order.OrderID}`);
                console.log(`Date: ${new Date(order.OrderDate).toISOString().slice(0,10)}`);
                console.log(`Total: $${order.TotalAmount.toFixed(2)}`);
                console.log(`Status: ${order.Status}`);
                
                console.log('\nItems:');
                order.Items.forEach(item => {
                    console.log(`- ${item.ProductName}`);
                    console.log(`  Quantity: ${item.Quantity}`);
                    console.log(`  Unit Price: $${item.UnitPrice.toFixed(2)}`);
                    console.log(`  Total: $${item.TotalPrice.toFixed(2)}`);
                });
            });
        } else {
            console.log('No orders found for this customer');
        }
        
    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

// Run the test
//testGetCustomerInfo();


async function checkEmailVerifiedUsers(username) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        request.input('Username', sql.VarChar, username);
        
        const result = await request.query(`
            SELECT CustomerID, Username, Email, IsEmailVerified
            FROM Customers
            WHERE IsDeleted=0 AND Username=@Username And IsEmailVerified=1;
        `);
        
        if (result.recordset.length === 0) {
            return { success: false, message: 'No users found' };
        }

        for (const user of result.recordset) {
            if (user.IsEmailVerified) {
                return { success: true, message: `User ${user.Username} has verified their email.` };
            }
        }

        return { success: false, message: 'User has not verified their email.' };
    } catch (error) {
        return { success: false, message: `Error fetching users: ${error.message}` };
    }
}
//checkEmailVerifiedUsers('Karamm');




module.exports = {generateToken,getCustomerInfoFromToken, loginUser,encryptPassword,verifyPassword };


