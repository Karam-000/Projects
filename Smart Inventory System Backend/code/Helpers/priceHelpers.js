const calculatePrice = (price, discountAmount, expirationDate) => {
    const isDiscountValid = discountAmount && expirationDate >= new Date();
    return price - (isDiscountValid ? discountAmount : 0);
};

module.exports = {
    calculatePrice,
};
