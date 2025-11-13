const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const router = express.Router();
const bodyParser = require('body-parser');
const { loginUser } = require('../Services/Login'); // Import the loginUser function
const {findCustomerByEmail}=require('../Helpers/helpers')
const bcrypt = require('bcryptjs');
const validator = require('validator');
router.use(bodyParser.json()); // Middleware to parse JSON request bodies
const {encryptPassword}=require('../Services/Login')
const {addCustomer,updateCustomer}=require('../Controllers/customers')
const crypto=require("crypto")
const {addVerificationToken,verifyTokenAndUpdate,checkResetToken,checkValidEmployeeToken}=require('../Helpers/helpers')
const {renewToken}=require('../Helpers/tokenHelpers')
const {sendEmail,sendResetPasswordEmail}=require('../Services/email')
// Public Route (No Auth Required)
router.get('/public', (req, res) => {
    res.json({ message: 'Public Route - No authentication required' });
});
//login route
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ status: 'error', message: 'Username and password are required' });
        }

        const loginResult = await loginUser(username, password);

        if (!loginResult.success) {
            let errorMessage = 'An error occurred';
            let statusCode = 401;

            if (loginResult.message === 'User not found') {
                errorMessage = 'Incorrect Username';
            } else if (loginResult.message === 'Incorrect password') {
                errorMessage = 'Incorrect Password';
            }

            return res.status(statusCode).json({ status: 'error', message: errorMessage });
        }

        res.status(200).json({
            status: 'success',
            user: loginResult.user,
            token: loginResult.token,
        });
    } catch (error) {
        next(error);
    }
});
//signup route
router.post('/signup', async (req, res, next) => {
    try {
        const { Username, Password, FirstName, LastName, Email, Phone } = req.body;

        if (!Username || !Password || !FirstName || !LastName || !Email || !Phone) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!validator.isEmail(Email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (!validator.isLength(Password, { min: 8 })) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (!validator.isMobilePhone(Phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format'
            });
        }

        const existingCustomer = await findCustomerByEmail(Email);
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

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

        const customerId = await addCustomer(customer);

        const verificationToken = crypto.randomBytes(20).toString('hex');
        const expirationDate = new Date(Date.now() + 3600000); // Token expires in 1 hour

        await addVerificationToken({
            CustomerID: customerId,
            Token: verificationToken,
            ExpirationDate: expirationDate
        });

        const verificationUrl = `http://localhost:3000/auth/verify?token=${verificationToken}`;
        const emailContent = `
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
        `;
        await sendEmail(
            'Verify Your Email',
            emailContent,
            Email,
            'no-reply@yourdomain.com'
        );

        res.status(201).json({
            success: true,
            message: 'Verification email sent'
        });
    } catch (error) {
        next(error);
    }
});
// Google Signup Route
router.post('/GoogleSignup', async (req, res, next) => {
    try {
        let credential;

        if (req.headers['content-type'] === 'application/json') {
            const parsedBody = req.body;
            credential = parsedBody.googleToken;
        } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            const parsedBody = new URLSearchParams(req.body);
            credential = parsedBody.get('credential');
        } else {
            const error = new Error('Unsupported content type');
            error.statusCode = 400;
            throw error;
        }

        if (!credential) {
            const error = new Error("Missing credential in request body.");
            error.statusCode = 400;
            throw error;
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: '', // Your Google Client ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, name, email } = payload;

        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        const existingCustomer = await findCustomerByEmail(email);
        if (existingCustomer) {
            return res.status(200).json({
                success: true,
                message: 'User already registered with Google Email.',
            });
        }

        const password = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newCustomer = {
            Username: name.split(' ')[0],
            PasswordHash: hashedPassword,
            FirstName: name.split(' ')[0],
            LastName: name.split(' ')[1] || '',
            Email: email,
            Phone: '',
            GoogleId: googleId,
            RegistrationDate: new Date(),
            IsEmailVerified: 1
        };

        await addCustomer(newCustomer);

        res.status(201).json({
            success: true,
            message: 'Customer registered successfully with Google.',
        });
    } catch (error) {
        next(error);
    }
});
// Email Verification Route
router.get('/verify', async (req, res, next) => {
    try {
        const token = req.query.token;

        if (!token) {
            return res.status(400).send('<h1>Invalid verification link</h1>');
        }

        const verificationResult = await verifyTokenAndUpdate(token);

        if (!verificationResult.success) {
            return res.status(400).send(`<h1>${verificationResult.message}</h1>`);
        }

        return res.status(200).send('<h1>Email verified successfully!</h1>');
    } catch (error) {
        next(error);
    }
});
router.post('/ResetPassword', async (req, res, next) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username is required.' });
        }

        const EmailResult = await sendResetPasswordEmail(username);

        if (EmailResult.success) {
            return res.status(200).json({ success: true, message: 'Password reset email sent.' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found or email failed to send.' });
        }
    } catch (error) {
        next(error);
    }
});
router.post('/Reset-Password', async (req, res, next) => {
    try {
        const { newPassword, token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        if (!validator.isLength(newPassword, { min: 8 })) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const CustomerID = await checkResetToken(token);

        if (CustomerID) {
            const passwordHash = await encryptPassword(newPassword);

            await updateCustomer(CustomerID, {
                PasswordHash: passwordHash
            });

            await markTokenAsUsed(token);

            return res.status(200).json({ success: true, message: 'Password updated successfully' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }
    } catch (error) {
        next(error);
    }
});
router.post('/LoginEmloyee', async (req, res, next) => {
    try {
        const { employeeId, password } = req.body;

        if (!employeeId || !password) {
            return res.status(400).json({ status: 'error', message: 'Employee ID and password are required' });
        }

        const loginResult = await loginEmployee(employeeId, password);

        if (loginResult.success === false) {
            if (loginResult.message === 'Employee not found') {
                return res.status(200).json({ message: "Incorrect Employee ID" });
            } else if (loginResult.message === 'Incorrect password') {
                return res.status(200).json({ message: "Incorrect Password" });
            }
        } else {
            return res.status(200).json({ token: loginResult.token });
        }
    } catch (error) {
        next(error);
    }
});
  /**
   * POST /renew-token
   * Renew a regular user token.
   */
  router.post('/renew-token', async (req, res, next) => {
    try {
        const { oldToken } = req.body;
        if (!oldToken || !validator.isJWT(oldToken)) {
            return res.status(400).json({ success: false, message: 'A valid token is required' });
        }
        const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
        const newToken = await renewToken(oldToken, process.env.JWT_SECRET, 'UserSessions', 'CustomerID', decoded.userId);
        res.status(200).json({
            success: true,
            message: 'Token renewed successfully',
            token: newToken,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/renew-employee-token', async (req, res, next) => {
    try {
        const { oldToken } = req.body;
        if (!oldToken || !validator.isJWT(oldToken)) {
            return res.status(400).json({ success: false, message: 'A valid token is required' });
        }
        const decoded = jwt.verify(oldToken, process.env.EMPLOYEE_SECRET);
        const newToken = await renewToken(oldToken, process.env.EMPLOYEE_SECRET, 'EmployeeLogin', 'EmployeeID', decoded.employeeId);
        res.status(200).json({
            success: true,
            message: 'Employee token renewed successfully',
            token: newToken,
        });
    } catch (error) {
        next(error);
    }
});
//9 routes 

  

module.exports = router;
