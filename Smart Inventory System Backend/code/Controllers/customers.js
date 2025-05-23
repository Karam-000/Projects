const { sql, poolPromise } = require('../Database/db');
const bcrypt = require('bcryptjs');
//===================================================================================================
async function encryptPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}
//===================================================================================================
// Function to add a new customer to the database
async function addCustomer(customer) {
    try {
        const pool = await poolPromise;

        // Encrypt the password
        const encryptedPassword = await encryptPassword(customer.Password);

        // Define the query for inserting a new customer
        const query = `
            INSERT INTO Customers (Username, PasswordHash, FirstName, LastName, Email, Phone, RegistrationDate, IsDeleted, IsEmailVerified)
            OUTPUT INSERTED.CustomerID  -- This will return the CustomerID of the inserted row
            VALUES (@Username, @PasswordHash, @FirstName, @LastName, @Email, @Phone, @RegistrationDate, 0, @IsEmailVerified)
        `;

        // Execute the query with parameters
        const result = await pool.request()
            .input('Username', sql.VarChar, customer.Username)
            .input('PasswordHash', sql.VarChar, encryptedPassword)
            .input('FirstName', sql.VarChar, customer.FirstName)
            .input('LastName', sql.VarChar, customer.LastName)
            .input('Email', sql.VarChar, customer.Email)
            .input('Phone', sql.VarChar, customer.Phone)
            .input('RegistrationDate', sql.Date, customer.RegistrationDate)
            .input('IsEmailVerified', sql.Bit, customer.IsEmailVerified)
            .query(query);

        // The CustomerID is now in the result.recordset[0].CustomerID
        return result.recordset[0].CustomerID; // Return the CustomerID of the newly added customer
    } catch (err) {
        if (err.code === 'EREQUEST' && err.number === 2627) {
            // Check for specific error message related to duplicate email
            if (err.message.includes('UQ__Customer__A9D1053435D930D6')) {
                throw new Error('Email already exists.');
            }
            // Check for specific error message related to duplicate username (Primary Key constraint)
            if (err.message.includes('UQ__Customer__536C85E4C90901C7')) {
                throw new Error('Username already exists.');
            }
        }

        console.error('Error adding customer:', err);
        throw err; // Re-throw other errors
    }
}
//===================================================================================================


// Function to add the customer
async function addCustomerTest() {
    const customer = {
        Username: 'petergrifin',  // You can adjust the username as needed
        PasswordHash: 'securepassword123',  // Default password before encryption
        FirstName: 'Peter',
        LastName: 'Grifin',
        Email: 'karamabousahyou00@gmail.com', // The email address provided
        Phone: '1234567890', // You can assign any phone number
        RegistrationDate: new Date(),  // Current date as the registration date
        IsEmailVerified: 0  // Assuming email is not verified initially

    };

    try {
        // Call the addCustomer function
        const result = await addCustomer(customer);
        console.log(`Customer created successfully: ${result}`);
    } catch (error) {
        console.error(`Error creating customer: ${error.message}`);
    }
}
//addCustomerTest()
//========================================add delivery location==============================================
async function addDeliveryLocation(username, location) {
    try {
        const pool = await poolPromise;

        // Validate Location Data
        if (!location || !location.Address || !location.City || !location.State || !location.ZipCode) {
            throw new Error('Location details are incomplete.');
        }

        console.log('Received location data:', location);

        // Get CustomerID based on Username
        const getCustomerQuery = `
            SELECT CustomerID 
            FROM Customers 
            WHERE Username = @Username
        `;
        
        const customerResult = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(getCustomerQuery);

        if (customerResult.recordset.length === 0) {
            throw new Error(`Customer with username "${username}" not found.`);
        }

        const customerID = customerResult.recordset[0].CustomerID;
        console.log("Customer ID from query:", customerID);  // Debugging output

        // Insert into DeliveryLocation
        const insertLocationQuery = `
            INSERT INTO DeliveryLocation (CustomerID, Address, City, State, ZipCode)
            VALUES (@CustomerID, @Address, @City, @State, @ZipCode)
        `;

        const result = await pool.request()
            .input('CustomerID', sql.Int, customerID)
            .input('Address', sql.VarChar, location.Address)
            .input('City', sql.VarChar, location.City)
            .input('State', sql.VarChar, location.State)
            .input('ZipCode', sql.VarChar, location.ZipCode)
            .query(insertLocationQuery);

        console.log('Delivery location added successfully.');
        return result;
    } catch (err) {
        console.error('Error adding delivery location:', err);
        throw err;  // Re-throwing for higher-level handling
    }
}
// addDeliveryLocation('Karamm', {
//     Address: '123 Main St',
//     City: 'Springfield',
//     State: 'IL',
//     ZipCode: '62701'
// })
//     .then(() => console.log('Delivery location added successfully!'))
//     .catch(err => console.error('Error:', err));
//======================================update delivery location ===========================================
async function updateDeliveryLocation(deliveryLocationID, updatedLocation) {
    try {
        const pool = await poolPromise;

        // Validate updated location data
        if (!updatedLocation || !updatedLocation.Address || !updatedLocation.City || !updatedLocation.State || !updatedLocation.ZipCode) {
            throw new Error('Location details are incomplete.');
        }

        console.log('Received updated location data:', updatedLocation);

        // Update DeliveryLocation based on DeliveryLocationID
        const updateLocationQuery = `
            UPDATE DeliveryLocation
            SET Address = @Address, City = @City, State = @State, ZipCode = @ZipCode
            WHERE DeliveryLocationID = @DeliveryLocationID
        `;

        const result = await pool.request()
            .input('DeliveryLocationID', sql.Int, deliveryLocationID)
            .input('Address', sql.VarChar, updatedLocation.Address)
            .input('City', sql.VarChar, updatedLocation.City)
            .input('State', sql.VarChar, updatedLocation.State)
            .input('ZipCode', sql.VarChar, updatedLocation.ZipCode)
            .query(updateLocationQuery);

        console.log('Delivery location updated successfully.');
        return result;
    } catch (err) {
        console.error('Error updating delivery location:', err);
        throw err;  // Re-throw for higher-level handling
    }
}
//======================================get delivery location =====================================================
async function getDeliveryLocations(username) {
    try {
        const pool = await poolPromise;

        // Get CustomerID based on Username
        const getCustomerQuery = `
            SELECT CustomerID 
            FROM Customers 
            WHERE Username = @Username
        `;
        
        const customerResult = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(getCustomerQuery);

        if (customerResult.recordset.length === 0) {
            throw new Error(`Customer with username "${username}" not found.`);
        }

        const customerID = customerResult.recordset[0].CustomerID;

        // Get all delivery locations for this customer
        const getLocationQuery = `
            SELECT DeliveryLocationID, Address, City, State, ZipCode
            FROM DeliveryLocation
            WHERE CustomerID = @CustomerID
        `;

        const locations = await pool.request()
            .input('CustomerID', sql.Int, customerID)
            .query(getLocationQuery);

        console.log('Delivery locations retrieved successfully.');
        return locations.recordset;
    } catch (err) {
        console.error('Error retrieving delivery locations:', err);
        throw err;  // Re-throw for higher-level handling
    }
}

//======================================delete delivery location ==================================================
async function deleteDeliveryLocation(deliveryLocationID) {
    try {
        const pool = await poolPromise;

        // Delete DeliveryLocation based on DeliveryLocationID
        const deleteLocationQuery = `
            DELETE FROM DeliveryLocation
            WHERE DeliveryLocationID = @DeliveryLocationID
        `;

        const result = await pool.request()
            .input('DeliveryLocationID', sql.Int, deliveryLocationID)
            .query(deleteLocationQuery);

        console.log('Delivery location deleted successfully.');
        return result;
    } catch (err) {
        console.error('Error deleting delivery location:', err);
        throw err;  // Re-throw for higher-level handling
    }
}

//--------------------------------------add payment----------------------------------------------------
async function addPayment(username, paymentDetails) {
    try {
        const pool = await poolPromise;

        // Retrieve CustomerID for the given username
        const getCustomerIdQuery = `
            SELECT CustomerID 
            FROM Customers 
            WHERE Username = @Username
        `;

        const customerResult = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(getCustomerIdQuery);

        if (customerResult.recordset.length === 0) {
            throw new Error(`Customer with username "${username}" not found.`);
        }

        const customerId = customerResult.recordset[0].CustomerID;

        // Insert payment details into Payment table
        const insertPaymentQuery = `
            INSERT INTO Payment (CustomerID, PaymentMethod, CardNumber, ExpiryDate, CVV)
            VALUES (@CustomerID, @PaymentMethod, @CardNumber, @ExpiryDate, @CVV)
        `;

        const result = await pool.request()
            .input('CustomerID', sql.Int, customerId)
            .input('PaymentMethod', sql.VarChar, paymentDetails.PaymentMethod)
            .input('CardNumber', sql.VarChar, paymentDetails.CardNumber)
            .input('ExpiryDate', sql.Date, paymentDetails.ExpiryDate)
            .input('CVV', sql.VarChar, paymentDetails.CVV)
            .query(insertPaymentQuery);

        console.log('Payment method added successfully.');
        return result;
    } catch (err) {
        console.error('Error adding payment method:', err);
        throw err;
    }
}
// const paymentDetails = {
//     PaymentMethod: 'Credit Card',
//     CardNumber: '1234567812345678',
//     ExpiryDate: '2025-12-31',
//     CVV: '123'
// };

// addPayment('Karamm', paymentDetails)
//     .then(() => console.log('Payment added successfully!'))
//     .catch(err => console.error('Error:', err));

// ======================Function to update payment details dynamically================================================
async function updatePayment(customerId, paymentId, paymentUpdates) {
    try {
        const pool = await poolPromise;

        // Check if the payment method exists for the given CustomerID and PaymentID
        const checkPaymentQuery = `
            SELECT PaymentID 
            FROM Payment 
            WHERE CustomerID = @CustomerID AND PaymentID = @PaymentID
        `;

        const paymentResult = await pool.request()
            .input('CustomerID', sql.Int, customerId)
            .input('PaymentID', sql.Int, paymentId)
            .query(checkPaymentQuery);

        if (paymentResult.recordset.length === 0) {
            throw new Error(`Payment method with ID "${paymentId}" not found for the given CustomerID.`);
        }

        // Update the specified payment method
        const updatePaymentQuery = `
            UPDATE Payment
            SET ${Object.keys(paymentUpdates).map((key) => `${key} = @${key}`).join(', ')}
            WHERE PaymentID = @PaymentID AND CustomerID = @CustomerID
        `;

        const request = pool.request()
            .input('CustomerID', sql.Int, customerId)
            .input('PaymentID', sql.Int, paymentId);

        // Dynamically add inputs for the payment updates
        Object.entries(paymentUpdates).forEach(([key, value]) => {
            request.input(key, sql.VarChar, value);
        });

        await request.query(updatePaymentQuery);

        console.log('Payment method updated successfully.');
        return { message: 'Payment method updated successfully.' };
    } catch (err) {
        console.error('Error updating payment method:', err);
        throw err;
    }
}

// ====================================Function to delete payment details======================================================
async function deletePayment(customerId, paymentId) {
    try {
        const pool = await poolPromise;

        // Check if the payment method exists for the given CustomerID and PaymentID
        const checkPaymentQuery = `
            SELECT PaymentID 
            FROM Payment 
            WHERE CustomerID = @CustomerID AND PaymentID = @PaymentID
        `;

        const paymentResult = await pool.request()
            .input('CustomerID', sql.Int, customerId)
            .input('PaymentID', sql.Int, paymentId)
            .query(checkPaymentQuery);

        if (paymentResult.recordset.length === 0) {
            throw new Error(`Payment method with ID "${paymentId}" not found for the given CustomerID.`);
        }

        // Delete the specified payment method
        const deletePaymentQuery = `
            DELETE FROM Payment
            WHERE PaymentID = @PaymentID AND CustomerID = @CustomerID
        `;

        await pool.request()
            .input('CustomerID', sql.Int, customerId)
            .input('PaymentID', sql.Int, paymentId)
            .query(deletePaymentQuery);

        console.log('Payment method deleted successfully.');
        return { message: 'Payment method deleted successfully.' };
    } catch (err) {
        console.error('Error deleting payment method:', err);
        throw err;
    }
}


// ===============================Function to read payment details=======================================================
async function readPayment(username) {
    try {
        const pool = await poolPromise;

        // Retrieve CustomerID for the given username
        const getCustomerIdQuery = `
            SELECT CustomerID 
            FROM Customers 
            WHERE Username = @Username
        `;

        const customerResult = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(getCustomerIdQuery);

        if (customerResult.recordset.length === 0) {
            throw new Error(`Customer with username "${username}" not found.`);
        }

        const customerId = customerResult.recordset[0].CustomerID;

        // Read payment details
        const readPaymentQuery = `
            SELECT PaymentMethod, CardNumber, ExpiryDate, CVV
            FROM Payment
            WHERE CustomerID = @CustomerID
        `;

        const result = await pool.request()
            .input('CustomerID', sql.Int, customerId)
            .query(readPaymentQuery);

        console.log('Payment details retrieved successfully.');
        return result.recordset;
    } catch (err) {
        console.error('Error reading payment details:', err);
        throw err;
    }
}


 //updatePayment(1, 2,{ CardNumber: '1234567812345678' });
// //1234567812345678

// const payments = readPayment('petergrifin');
// console.log(payments);

//deletePayment('petergrifin');

//===================================================================================================
// update customer information
/**
 * Updates a customer in the database.
 * @param {number} customerID - The ID of the customer to update.
 * @param {object} updates - The fields to update (key-value pairs).
 * @returns {Promise<string>} - A success message or an error.
 */
async function updateCustomer(customerID, updates) {
    if (!customerID) {
        throw new Error("CustomerID is required");
    }

    // Check if there are fields to update
    const updateFields = [];
    const params = [];

    if (updates.Username) {
        updateFields.push("Username = @Username");
        params.push({ name: "Username", type: sql.VarChar(50), value: updates.Username });
    }
    if (updates.PasswordHash) {
        updateFields.push("PasswordHash = @PasswordHash");
        params.push({ name: "PasswordHash", type: sql.VarChar(255), value: updates.PasswordHash });
    }
    if (updates.FirstName) {
        updateFields.push("FirstName = @FirstName");
        params.push({ name: "FirstName", type: sql.VarChar(50), value: updates.FirstName });
    }
    if (updates.LastName) {
        updateFields.push("LastName = @LastName");
        params.push({ name: "LastName", type: sql.VarChar(50), value: updates.LastName });
    }
    if (updates.Email) {
        updateFields.push("Email = @Email");
        params.push({ name: "Email", type: sql.VarChar(100), value: updates.Email });
    }
    if (updates.PhoneNumber) {
        updateFields.push("Phone = @Phone");
        params.push({ name: "Phone", type: sql.VarChar(20), value: updates.PhoneNumber });
    }
    if (updates.RegistrationDate) {
        updateFields.push("RegistrationDate = @RegistrationDate");
        params.push({ name: "RegistrationDate", type: sql.Date, value: updates.RegistrationDate });
    }

    if (updateFields.length === 0) {
        throw new Error("No fields to update");
    }

    const query = `
        UPDATE Customers
        SET ${updateFields.join(", ")}
        WHERE CustomerID = @CustomerID
    `;

    try {
        const pool = await poolPromise;
        const request = pool.request();

        // Add parameters to the SQL request
        params.forEach(param => request.input(param.name, param.type, param.value));
        request.input("CustomerID", sql.Int, customerID);

        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            throw new Error("Customer not found");
        }

        return "Customer updated successfully";
    } catch (err) {
        console.error("Error updating customer:", err);
        throw err;
    }
}
//===================================================================================================

//delete custumer 
async function deleteCustomer(username) {
    try {
        const pool = await poolPromise;
        // Mark the customer as deleted
        await pool.request()
            .input('username', sql.NVarChar, username)
            .query('UPDATE Customers SET IsDeleted = 1 WHERE Username = @username');

        return { success: true, message: 'Customer marked as deleted successfully.' };
    } catch (error) {
        console.error('Error marking customer as deleted:', error.message);
        return { success: false, message: error.message };
    }
}

//===================================================================================================
async function getCustomerByID(customerID) {
    try {
        const pool = await poolPromise;

        const query = `
            SELECT *
            FROM Customers
            WHERE CustomerID = @CustomerID
        `;

        const result = await pool.request()
            .input('CustomerID', sql.Int, customerID)
            .query(query);

        return result.recordset[0]; // Return the first (and presumably only) record
    } catch (err) {
        console.error('Error fetching customer:', err);
        throw err;
    }
}
async function getCustomerByUsername(username) {
    try {
        const pool = await poolPromise;

        const query = `
            SELECT *
            FROM Customers
            WHERE Username = @Username
        `;

        const result = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(query);

        return result.recordset[0]; // Return the first (and presumably only) record
    } catch (err) {
        console.error('Error fetching customer:', err);
        throw err;
    }
}
async function test() {
    try {
        const customer = await getCustomerByUsername('karamm');
        console.log(customer); // Log the customer details
    } catch (error) {
        console.error('Error fetching customer:', error.message);
    }
}
//test()

//===================================================================================================
// function to get customer orders 
async function getCustomerOrders(username){
    try {
        const pool = await poolPromise;

        const query = `
            SELECT 
    Orders.OrderID,
    Orders.Username,
    Orders.BranchID,
    Orders.OrderDate,
    Orders.TotalAmount,
    Orders.Status,
    STRING_AGG(
        Product.ProductName + ' (x' + CAST(orderItems.Quantity AS VARCHAR) + ', $' + CAST(Product.Price AS VARCHAR) + ')',
        ', '
    ) AS Products
FROM Orders
INNER JOIN orderItems ON Orders.OrderID = orderItems.OrderID
INNER JOIN Product ON orderItems.ProductID = Product.ProductID
WHERE Orders.Username = @Username
GROUP BY 
    Orders.OrderID,
    Orders.Username,
    Orders.BranchID,
    Orders.OrderDate,
    Orders.TotalAmount,
    Orders.Status
ORDER BY Orders.OrderDate, Orders.OrderID;
            
        `;

        const result = await pool.request()
            .input('Username', sql.VarChar, username)
            .query(query);

        return result.recordset; // Return the orders
    } catch (err) {
        console.error('Error fetching customer orders:', err);
        throw err;
    }
}
//test get customer orders
async function testGetCustomerOrders() {
    try {
        const orders = await getCustomerOrders('karamm');
        console.log('Customer Orders:', orders); // Log the orders
    } catch (error) {    
        console.error('Error fetching customer orders:', error.message);
    }
}
//testGetCustomerOrders();
//===================================================================================================

module.exports = {
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerByID,
    addPayment,
    addDeliveryLocation,
    deletePayment,
    updatePayment,
    readPayment,
    updateDeliveryLocation,
    deleteDeliveryLocation,
    getDeliveryLocations,
    getCustomerByUsername,
    getCustomerOrders
}
  