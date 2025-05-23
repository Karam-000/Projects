const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const router = express.Router();
const bodyParser = require('body-parser');
const { loginUser } = require('../Services/Login'); // Import the loginUser function
const {findCustomerByEmail}=require('../Helpers/helpers')
const bcrypt = require('bcryptjs');
router.use(bodyParser.json()); // Middleware to parse JSON request bodies
const {encryptPassword}=require('../Services/Login')
const {addCustomer,updateCustomer}=require('../Controllers/customers')
const crypto=require("crypto")
const {addVerificationToken,verifyTokenAndUpdate,checkResetToken,checkTokenInSession,checkValidEmployeeToken}=require('../Helpers/helpers')
const {sendEmail,sendResetPasswordEmail}=require('../Services/email')
// Public Route (No Auth Required)
router.get('/public', (req, res) => {
    res.json({ message: 'Public Route - No authentication required' });
});
//login route
router.post('/login', async (req, res) => {
    try {
        console.log('Login request body:', req.body); // Debugging line
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ status: 'error', message: 'Username and password are required' });
        }

        // Call loginUser function
        const loginResult = await loginUser(username, password);

        if (!loginResult.success) {
            let errorMessage = 'An error occurred';
            let statusCode = 401; // Unauthorized by default

            // Handling different login failure cases
            if (loginResult.message === 'User not found') {
                errorMessage = 'Incorrect Username';
            } else if (loginResult.message === 'Incorrect password') {
                errorMessage = 'Incorrect Password';
            }

            return res.status(statusCode).json({ status: 'error', message: errorMessage });
        }

        // Send response with JWT token
        res.status(200).json({
            status: 'success',
            user: loginResult.user,
            token: loginResult.token,
        });

    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});
//signup route
router.post('/signup', async (req, res) => {
    try {
        const { Username, Password, FirstName, LastName, Email, Phone } = req.body;

        // Input validation
        if (!Username || !Password || !FirstName || !LastName || !Email || !Phone) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if the email already exists in the system
        const existingCustomer = await findCustomerByEmail(Email);
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        

        // Create customer object
        const customer = {
            Username,
            Password,
            FirstName,
            LastName,
            Email,
            Phone,
            RegistrationDate: new Date(),
            IsEmailVerified: 0
        };

        // Add customer to the database
        const customerId = await addCustomer(customer);
        console.log('New customer added:', customerId);

        
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const expirationDate = new Date(Date.now() + 3600000); // Token expires in 1 hour

        // Store the verification token
        await addVerificationToken({
            CustomerID: customerId,
            Token: verificationToken,
            ExpirationDate: expirationDate
        });

        // Send verification email
        const verificationUrl = `http://localhost:3000/auth/verify?token=${verificationToken}`;
        const emailContent = `
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
        `;
        await sendEmail(
            'Verify Your Email', // Subject
            emailContent,        // Email content
            Email,               // Recipient
            'no-reply@yourdomain.com' // From address
        );

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Verification email sent'
        });

    } catch (error) {
        console.error('Signup error:', error);

        // Error handling for different cases
        if (error.message.includes('Email already exists')) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
});
// Google Signup Route
router.post('/GoogleSignup', async (req, res) => {
    try {
        let credential;

        // Check if request is JSON or URL-encoded
        if (req.headers['content-type'] === 'application/json') {
            const parsedBody = req.body; // Express automatically parses JSON body
            credential = parsedBody.googleToken;
        } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            const parsedBody = new URLSearchParams(req.body);
            credential = parsedBody.get('credential');
        } else {
            throw new Error('Unsupported content type');
        }

        if (!credential) {
            throw new Error("Missing credential in request body.");
        }

        // Verify the Google token using your Client ID
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: '', // Your Google Client ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, name, email } = payload;

        // Validate email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        // Check if user already exists
        const existingCustomer = await findCustomerByEmail(email);
        if (existingCustomer) {
            return res.status(200).json({
                success: true,
                message: 'User already registered with Google Email.',
            });
        }

        // Create a new customer object
        const newCustomer = {
            Username: name.split(' ')[0],
            PasswordHash: '', // No password needed for Google signup
            FirstName: name.split(' ')[0],
            LastName: name.split(' ')[1] || '',
            Email: email,
            Phone: '', // Phone can be optional or empty
            GoogleId: googleId,
            RegistrationDate: new Date(),
            IsEmailVerified: 1 // Automatically verified
        };

        // Store new customer in the database
        await addCustomer(newCustomer);

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Customer registered successfully with Google.',
        });

    } catch (error) {
        console.error('Error in Google signup:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});
// Email Verification Route
router.get('/verify', async (req, res) => {
    const token = req.query.token;

    if (!token) {
        return res.status(400).send('<h1>Invalid verification link</h1>');
    }

    try {
        const verificationResult = await verifyTokenAndUpdate(token);

        if (!verificationResult.success) {
            return res.status(400).send(`<h1>${verificationResult.message}</h1>`);
        }

        return res.status(200).send('<h1>Email verified successfully!</h1>');
        
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).send('<h1>Verification failed</h1>');
    }
});
router.post('/ResetPassword', async (req, res) => {
    try {
        const { username} = req.body;
        if (!username) {
            // Check if the username is provided
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Username is required.' }));
            return;
        }

        // Proceed to send the reset password email
        const EmailResult = await sendResetPasswordEmail(username);

        if (EmailResult.success) {
            // If email sending is successful, send a success response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Password reset email sent.' }));
        } else {
            // Handle cases where the email sending failed (e.g., user not found)
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User not found or email failed to send.' }));
        }
    } catch (error) {
        console.error('Error during operation:', error.message);

        // Respond with a generic server error message in case of unexpected errors
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Internal server error.' }));
    }
});
router.post('/Reset-Password', async (req, res) => {
    console.log("Request received for /Reset-Password endpoint");
          
            let body = '';
          
            req.on('data', chunk => {
              body += chunk.toString();
            });
          
            req.on('end', async () => {
              try {
                console.log("Request body received:", body);
          
                const { newPassword, token } = JSON.parse(body); // Username is now retrieved from the token
                
                if (!token) {
                  throw new Error('Token is required');
                }
          
                console.log("Token received:", token);
          
                // Check token and get username
                const CustomerID= await checkResetToken(token);
                console.log("Username retrieved from token:", username);
          
                if (username) {
                  console.log("Proceeding with password update");
                  const passwordHash = await encryptPassword(newPassword);
                  console.log("Password encrypted");
          
                  // Update customer password
                  const updatePasswordResult = await updateCustomer(CustomerID,{
                    Username: username,
                    PasswordHash: passwordHash
                  });
                  console.log("Password updated in database:", updatePasswordResult);
          
                  // Mark the token as used
                  await markTokenAsUsed(token);
                  console.log("Token marked as used");
          
                  // Send a response with the result
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, message: 'Password updated successfully' }));
                } else {
                  console.log("Invalid or expired token");
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, message: 'Invalid or expired token' }));
                }
              } catch (error) {
                console.error('Error during operation:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
              }
            });
        });
router.post('/LoginEmloyee', async (req, res) => {
    const { employeeId, password } = req.body;
    console.log('Login request body:', req.body); // Debugging line
    if (!employeeId || !password) {
        return res.status(400).json({ status: 'error', message: 'Employee ID and password are required' });
    }
    try{
    const loginResult = await loginEmployee(employeeId, password);
          if (loginResult.success === false) {
              if (loginResult.message === 'Employee not found') {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.write(JSON.stringify({ message: "Incorrect Employee ID" }));
                  res.end();
              } else if (loginResult.message === 'Incorrect password') {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.write(JSON.stringify({ message: "Incorrect Password" }));
                  res.end();
              }
          } else {
              // Send a response with the employee data and JWT token
              const response = {
                  
                  token: loginResult.token
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.write(JSON.stringify(response));
              res.end();
          }
      } catch (error) {
          console.error('Error during employee login:', error.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.write(JSON.stringify({ success: false, message: error.message }));
          res.end();
      }
  }); 
  /**
   * POST /renew-token
   * Renew a regular user token.
   */
  router.post('/renew-token', async (req, res) => {
    try {
      const { oldToken } = req.body;
      if (!oldToken) {
        return res.status(400).json({ success: false, message: 'Token is required' });
      }
  
      // Verify the old token using a secret (replace '0000' with your secret or process.env.JWT_SECRET)
      const decoded = jwt.verify(oldToken, process.env.JWT_SECRET || '0000');
      const customerId = decoded.userId; // Assuming customerId is in the payload
      console.log('Decoded token:', decoded);
      console.log('Customer ID:', customerId);
  
      // Check if token exists in the UserSessions table
      const pool = await poolPromise;
      const request = pool.request();
      request.input('Username', sql.VarChar, decoded.username); // DB username should match decoded username
      request.input('OldToken', sql.VarChar, oldToken);
      const sessionResult = await request.query(`
        SELECT * FROM UserSessions
        WHERE Username = @Username AND Token = @OldToken;
      `);
  
      if (sessionResult.recordset.length === 0) {
        return res.status(401).json({ success: false, message: 'Session not found or token is invalid' });
      }
  
      // Generate a new token (using your helper)
      const newToken = generateToken(customerId, decoded.username);
  
      // Update the session with the new token in the database
      const updateSessionRequest = pool.request();
      updateSessionRequest.input('Username', sql.VarChar, decoded.username);
      updateSessionRequest.input('OldToken', sql.VarChar, oldToken);
      updateSessionRequest.input('NewToken', sql.VarChar, newToken);
      await updateSessionRequest.query(`
        UPDATE UserSessions
        SET Token = @NewToken
        WHERE Username = @Username AND Token = @OldToken;
      `);
  
      return res.status(200).json({
        success: true,
        message: 'Token renewed successfully',
        token: newToken,
      });
    } catch (error) {
      console.error('Error renewing token:', error.message);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  /**
   * POST /renew-employee-token
   * Renew an employee token.
   */
  router.post('/renew-employee-token', async (req, res) => {
    try {
      const { oldToken } = req.body;
      if (!oldToken) {
        return res.status(400).json({ success: false, message: 'Token is required' });
      }
  
      // Verify the old token using your employee secret (replace '1234' with your secret or process.env.EMPLOYEE_SECRET)
      const oldDecoded = jwt.verify(oldToken, process.env.EMPLOYEE_SECRET || '1234');
      console.log('Old decoded employee token:', oldDecoded.employeeId);
  
      // Use helper to verify the token against your database/session logic
      const decoded = await checkValidEmployeeToken(oldDecoded.employeeId, oldToken);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Invalid or expired employee token' });
      }
  
      const { employeeId, employeeName, DepartmentName } = decoded;
  
      // Generate a new token for the employee
      const tokenPayload = { DepartmentName, employeeId, employeeName };
      const newToken = jwt.sign(tokenPayload, process.env.EMPLOYEE_SECRET || '1234', { expiresIn: '1h' });
      console.log('New employee token:', newToken);
  
      // Update the session in the EmployeeLogin table with the new token
      const pool = await poolPromise;
      const updateSessionRequest = pool.request();
      updateSessionRequest.input('EmployeeID', sql.Int, employeeId);
      updateSessionRequest.input('OldToken', sql.VarChar, oldToken);
      updateSessionRequest.input('NewToken', sql.VarChar, newToken);
      await updateSessionRequest.query(`
        UPDATE EmployeeLogin
        SET Token = @NewToken
        WHERE EmployeeID = @EmployeeID AND Token = @OldToken;
      `);
  
      return res.status(200).json({
        success: true,
        message: 'Employee token renewed successfully',
        token: newToken,
      });
    } catch (error) {
      console.error('Error renewing employee token:', error.message);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  });
//9 routes 

  

module.exports = router;
