const { body, validationResult } = require('express-validator');

const validateAddToCart = [
    body('username').notEmpty().withMessage('Username is required'),
    body('inventoryId').isInt().withMessage('Inventory ID must be an integer'),
    body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];

module.exports = {
    validateAddToCart,
};
