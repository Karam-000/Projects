const jwt = require('jsonwebtoken');
const { checkTokenInSession,checkValidEmployeeToken } = require('../Helpers/helpers');


const authenticateCustomer = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ 
            status: 'error', 
            message: 'Authorization token required' 
        });
    }

    try {
        
        
        // 2. Optional: Check if token exists in session/database
        const validToken = await checkTokenInSession(token);
        if (!validToken) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Token revoked' 
            });
        }
        // console.log('Valid token:', validToken);
        // 3. Attach user data to request
        req.user = {
            id: validToken.userId,    // Assuming your JWT contains userId
            username: validToken.username,
            
        };
        //  console.log('Authenticated user:', req.user);
        //  console.log('Udername:', req.user.username);
        //  console.log('User ID:', req.user.id);
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'Token expired' 
            });
        }
        
        return res.status(401).json({ 
            status: 'error', 
            message: 'Invalid token' 
        });
    }
};



// 🔹 Middleware for Role-Based Authorization
const adminMiddleware = (department) => async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    try {
        const decoded = await checkValidEmployeeToken(token);
        if (!decoded || decoded.DepartmentName !== department) {
            return res.status(403).json({ success: false, message: `Access denied - ${department} only` });
        }

        req.employee = {
            Id: decoded.employeeId,
            EmployeeName: decoded.employeeName,
            Department: decoded.DepartmentName
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

module.exports = { authenticateCustomer, adminMiddleware };

