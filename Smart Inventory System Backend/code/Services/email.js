const nodemailer = require('nodemailer');
const { poolPromise, sql } = require('../Database/db');
const jwt = require('jsonwebtoken');
//======================insert reset token to sql table=================================================
const insertResetPasswordToken = async (token, username) => {
  try {
    const pool = await poolPromise;

    // Calculate expiration date (1 hour from now) and convert to UTC
    const expirationDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const expirationDateUTC = new Date(expirationDate.getTime() - expirationDate.getTimezoneOffset() * 60000); // Convert to UTC

    console.log('Calculated expiration date (UTC):', expirationDateUTC.toISOString());

    await pool.request()
      .input('Token', sql.VarChar, token)
      .input('Username', sql.VarChar(50), username)
      .input('ExpirationDate', sql.DateTime, expirationDateUTC.toISOString()) // Use DateTime for SQL Server
      .query('INSERT INTO ResetPasswordTokens (Token, Username, ExpirationDate) VALUES (@Token, @Username, @ExpirationDate)');
    
    console.log('Reset password token inserted successfully');
  } catch (err) {
    console.error('Error inserting reset password token:', err.message);
    throw err;
  }
};

//===================================================================================================
//======================send email with reset token=====================================================
const sendEmail = async (subject, message, recipientEmail, sent_from) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: '//add your email',
      pass: '//add app password',
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  console.log('Sending email to:', recipientEmail); // Debugging line

  if (!recipientEmail) {
    throw new Error('No recipient email address provided');
  }

  const options = {
    from: sent_from,
    to: recipientEmail,
    subject: subject,
    html: message,
  };

  try {
    const info = await transporter.sendMail(options);
    console.log('Email sent:', info);
  } catch (err) {
    console.error('Error sending email:', err);
  }
};
//========================================genrate tiken for reset email ===================================
const generateToken = (userId, username) => {
  const tokenPayload = { userId, username };
  const token = jwt.sign(tokenPayload, '1111', { expiresIn: '4h' });
  console.log(`JWT token created: ${token}`);
  return token;
};
//===================================================================================================
//==========================================send reset email with html link===========================
const sendResetPasswordEmail = async (username) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input('Username', sql.VarChar, username)
      .query('SELECT Email, CustomerID FROM Customers WHERE Username = @Username');

    console.log('Query result:', result.recordset);

    if (result.recordset.length > 0) {
      const { Email, CustomerID } = result.recordset[0];
      console.log('Retrieved email:', Email);

      if (!Email) {
        throw new Error('No email address found for this user');
      }

      // Generate token
      const token = generateToken(CustomerID, username);

      // Insert token into database
      await insertResetPasswordToken(token, username);
      //http://127.0.0.1:5500/code/ForgetPassword.html
      const subject = 'Reset Password';
      const message = `<p>Click the link below to reset your password:</p>
                       <a href="http://127.0.0.1:5500/ForgetPassword.html?token=${token}">Reset Password</a>`;
      const sent_from = 'your_email@gmail.com';

      await sendEmail(subject, message, Email, sent_from);
      console.log('Reset password email sent to:', Email);
      return `Reset password email sent to: ${Email}`;
    } else {
      console.log('No user found with username:', username);
      return `No user found with username: ${username}`;
    }
  } catch (err) {
    console.error('Error:', err.message);
    return `Error: ${err.message}`;
  }
};

//===================================================================================================


//sendResetPasswordEmail('user5')



// Example usage
//sendResetPasswordEmail('user7');
//=======================================================================================================
module.exports = {sendResetPasswordEmail,
  sendEmail}
  ;


 