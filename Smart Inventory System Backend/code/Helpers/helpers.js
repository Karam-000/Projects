// Import necessary modules
const { sql, poolPromise } = require('../Database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {sendEmail} = require('../Services/email');

//===========================================check Employee Token===================================
async function checkValidEmployeeToken(token) {
 
    try {
      const pool = await poolPromise;
      console.log('Connected to SQL database');
      // Check if token exists in EmployeeLogin for the provided employeeId
      const loginResult = await pool.request()
        .input('token', sql.VarChar(255), token)
        .query(`
          SELECT * 
           FROM EmployeeLogin 
           WHERE Token = @token

        `);
         console.log('Query executed successfully');
      if (loginResult.recordset.length === 0) {
        console.log('Token not found in EmployeeLogin table');
        return false; // Token not found for this employee
      }
  
      try {

        // Decode JWT token
        const decodedToken = jwt.verify(token, '1234'); // Your JWT secret key
        console.log('Decoded token:', decodedToken);
        const employeeId = decodedToken.employeeId; // Extract employeeId from the token
        console.log('Employee ID:', employeeId);
        
  
        return decodedToken; // Token is valid

      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          console.log('Token has expired. Cleaning up expired tokens.');
          const decode= jwt.decode(token);
          const employeeId = decode.EmployeeID; // Extract employeeId from the token
          console.log('Employee ID:', employeeId);
          // Delete all expired tokens for the employee
          await pool.request()
            .input('employeeId', sql.Int, employeeId)
            .query(`
              DELETE FROM EmployeeLogin 
              WHERE EmployeeID = @employeeId AND LoginTime < GETDATE()
            `); // Assuming you have an ExpiryDate column to track token expiry
  
          return false; // Return false since token is expired
        }
  
        // For other JWT errors, rethrow the error
        throw err;
      }
    } catch (err) {
      console.error('Error checking token validity:', err.message);
      return false; // Return false in case of an error
    }
  }
  async function test2() {
    const test= await checkValidEmployeeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJEZXBhcnRtZW50TmFtZSI6IkhSIiwiZW1wbG95ZWVJZCI6MSwiZW1wbG95ZWVOYW1lIjoiIEthcmFtIEFib3UgU2FoeW91biIsImlhdCI6MTc0MzcwMjgyNiwiZXhwIjoxNzQzNzA2NDI2fQ.kiCgs6oUTpXUi0babs-cQmGlXER7KGo0vo5MlnKuOv8')
  console.log(test)
  }
 //test2()
  //=======================================================================================
  
 
   
//=============== Function to check the token in the UserSessions table====================
  async function checkTokenInSession(token) {
    try {
        // Verify the JWT token
       const decodedToken= jwt.verify(token, '0000'); 
        
        
        return decodedToken; 
        
  
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            // If the token is expired, delete it from the UserSessions table
            try {
                const pool = await poolPromise;
                const request = new sql.Request(pool);
                request.input('Token', sql.NVarChar, token);
                await request.query(`
                    DELETE FROM UserSessions
                    WHERE Token = @Token;
                `);
            } catch (error) {
                console.error('Error deleting expired token:', error.message);
            }
            return false; // The token is not valid because it is expired
        } else {
            // Handle other verification errors
            console.error('Error verifying token:', err.message);
            return false;
        }
    }
  }
  
  //============================================================================================
  // Function to check the token in the ResetPasswordTokens table
  
  const checkResetToken = async (token) => {
    try {
      // Verify the JWT token
      const userName=jwt.verify(token, '1111'); // Replace 'your-secret-key' with your actual secret key
      
      // If the token is valid, return true
      
      return userName.CustomerID;
  
  } catch (err) {
      if (err.name === 'TokenExpiredError') {
          // If the token is expired, delete it from the UserSessions table
          try {
              const pool = await poolPromise;
              const request = new sql.Request(pool);
              request.input('Token', sql.NVarChar, token);
              await request.query(`
                  DELETE FROM ResetPasswordTokens
                  WHERE Token = @Token;
              `);
          } catch (error) {
              console.error('Error deleting expired token:', error.message);
          }
          return false; // The token is not valid because it is expired
      } else {
          // Handle other verification errors
          console.error('Error verifying token:', err.message);
          return false;
      }
  }
    };
   
    // Function to mark token as used
const markTokenAsUsed = async (token) => {
      try {
        const pool = await poolPromise;
        await pool.request()
          .input('Token', sql.VarChar, token)
          .query('UPDATE ResetPasswordTokens SET Used = 1 WHERE Token = @Token');
      } catch (err) {
        console.error('Error marking token as used:', err.message);
        throw err;
      }
    };
  //============================================================================================
  //================================= Database helper functions===================================

  async function addVerificationToken(tokenData) {
      try {
        const { CustomerID, Token, ExpirationDate } = tokenData;
        const pool = await poolPromise;
        const request = pool.request();
        
        // Convert to UTC before insertion
        const utcExpirationDate = new Date(ExpirationDate.getTime() - (ExpirationDate.getTimezoneOffset() * 60000));
        
        request.input('CustomerID', sql.Int, CustomerID);
        request.input('Token', sql.VarChar(255), Token);
        request.input('ExpirationDate', sql.DateTime, utcExpirationDate); // Use UTC date
        
        await request.query(`
          INSERT INTO EmailVerificationTokens (CustomerID, Token, ExpirationDate)
          VALUES (@CustomerID, @Token, @ExpirationDate)
        `);
      } catch (error) {
        console.error('Token insertion error:', error.message);
        throw new Error('Failed to create verification token');
      }
    }
  
  async function verifyTokenAndUpdate(token) {
      const pool = await poolPromise; // Await poolPromise
      const transaction = new sql.Transaction(pool);
      
      try {
          await transaction.begin();
          
          // 1. Find valid token
          const tokenRequest = new sql.Request(transaction);
          tokenRequest.input('Token', sql.VarChar(255), token);
          
          const tokenResult = await tokenRequest.query(`
              SELECT * FROM EmailVerificationTokens 
              WHERE Token = @Token 
              AND ExpirationDate > GETDATE()
          `);
          
          if (tokenResult.recordset.length === 0) {
              throw new Error('Invalid or expired token');
          }
          
          const tokenRecord = tokenResult.recordset[0];
          
          // 2. Update customer verification status
          const updateRequest = new sql.Request(transaction);
          updateRequest.input('CustomerID', sql.Int, tokenRecord.CustomerID);
          
          await updateRequest.query(`
              UPDATE Customers 
              SET IsEmailVerified = 1 
              WHERE CustomerID = @CustomerID
          `);
          
          // 3. Delete used token
          const deleteRequest = new sql.Request(transaction);
          deleteRequest.input('Token', sql.VarChar(255), token);
          
          await deleteRequest.query(`
              DELETE FROM EmailVerificationTokens 
              WHERE Token = @Token
          `);
          
          await transaction.commit();
          return { success: true };
      } catch (error) {
          await transaction.rollback();
          return { success: false, message: error.message };
      }
  }
  //=============================================================================================
  // function to check email verified users 
  async function checkEmailVerifiedUsers(username) {
    try {
      // Fetch customer data
      const customer = await findCustomerByUsername(username);
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
  
      // If email is already verified
      if (customer.IsEmailVerified) {
        return { success: true, verified: true };
      }
  
      // Generate verification token and URL
      const verificationToken = crypto.randomBytes(20).toString('hex');
      const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      const verificationUrl = `http://localhost:3000/auth/verify?token=${verificationToken}`;
  
      // Cleanup and store new token
      await deleteVerificationTokensByCustomerID(customer.CustomerID);
      await addVerificationToken({
        CustomerID: customer.CustomerID,
        Token: verificationToken,
        ExpirationDate: expirationDate
      });
  
      // Send verification email
      const emailContent = `
        <p>Please verify your email to complete your order:</p>
        <a href="${verificationUrl}">Verify Now</a>
      `;
      await sendEmail(
        customer.Email,
        'Verify Your Email to Place Order',
        emailContent,
        'no-reply@yourdomain.com'
      );
  
      // Return verification status
      return { success: true, verified: false };
  
    } catch (error) {
      console.error('Verification process failed:', error);
      return { 
        success: false, 
        message: 'Verification email failed to send',
        error: error.message 
      };
    }
  }
  async function testCheckEmailVerifiedUsers() {
      try {
          const result = await checkEmailVerifiedUsers('Karamm'); // Change to a valid username
          console.log(result);
      } catch (error) {
          console.error('Test failed:', error);
      }
  }
  //testCheckEmailVerifiedUsers()

  // Find customer by username
  async function findCustomerByUsername(username) {
      const pool = await poolPromise;
      const request = pool.request();
      request.input('Username', sql.VarChar, username);
      const result = await request.query(`
          SELECT * FROM Customers 
          WHERE Username = @Username
      `);
      return result.recordset[0] || null;
  }
  async function testFindCustomerByUsername() {
      try {
          const test = await findCustomerByUsername('Karam');  // Change to a valid username
          console.log(test);
      } catch (error) {
          console.error('Test failed:', error);
      }
  }
  //testFindCustomerByUsername()
  // Delete existing verification tokens
  async function deleteVerificationTokensByCustomerID(customerID) {
      const pool = await poolPromise;
      const request = pool.request();
      request.input('CustomerID', sql.Int, customerID);
      await request.query(`
          DELETE FROM EmailVerificationTokens 
          WHERE CustomerID = @CustomerID
      `);
  }
  async function testDeleteVerificationTokensByCustomerID() {
      try {
          await deleteVerificationTokensByCustomerID(28); // Change to a valid customer ID
          console.log('Tokens deleted');
      } catch (error) {
          console.error('Test failed:', error);
      }
  }
  //testDeleteVerificationTokensByCustomerID()
  
  
  
  
  //==============================check if customer already exist =================================================
// Function to check if a customer already exists in the database
async function findCustomerByEmail(email) {
    try {
        const pool = await poolPromise;
        const request = new sql.Request(pool);
        request.input('Email', sql.NVarChar, email);
        
        const result = await request.query(`
            SELECT * FROM Customers WHERE Email = @Email;
        `);
        
        if (result.recordset.length > 0) {
            return true; // Customer found
        } else {
            return false; // No customer found
        }
    } catch (error) {
        console.error('Error finding customer by email:', error.message);
        return false;
    }
}
async function test () {
    const test=await findCustomerByEmail('karamabousahyoun@gmail.com')
    console.log(test)
}
//test()
//==============================check token =================================================
const cleanupExpiredTokens = async () => {
    try {
      const pool = await poolPromise;
      await pool.request()
        .query('DELETE FROM ResetPasswordTokens WHERE ExpirationDate < GETDATE() AND Used = 0');
      console.log('Expired tokens cleaned up');
    } catch (err) {
      console.error('Error cleaning up expired tokens:', err.message);
    }
  };

  module.exports = {
    checkValidEmployeeToken,
    checkTokenInSession,
    checkResetToken,
    markTokenAsUsed,
    findCustomerByEmail,
    addVerificationToken,
    verifyTokenAndUpdate,
    findCustomerByUsername,
    deleteVerificationTokensByCustomerID,
    cleanupExpiredTokens
  };