const jwt = require('jsonwebtoken');
const { poolPromise, sql } = require('../Database/db');

const renewToken = async (oldToken, secret, sessionTable, idColumn, idValue) => {
    const decoded = jwt.verify(oldToken, secret);
    const pool = await poolPromise;
    const request = pool.request();
    request.input('OldToken', sql.VarChar, oldToken);
    request.input(idColumn, sql.Int, idValue);
    const sessionResult = await request.query(`
        SELECT * FROM ${sessionTable}
        WHERE ${idColumn} = @${idColumn} AND Token = @OldToken;
    `);

    if (sessionResult.recordset.length === 0) {
        throw new Error('Session not found or token is invalid');
    }

    const tokenPayload = { userId: idValue };
    const newToken = jwt.sign(tokenPayload, secret, { expiresIn: '1h' });

    const updateSessionRequest = pool.request();
    updateSessionRequest.input('OldToken', sql.VarChar, oldToken);
    updateSessionRequest.input('NewToken', sql.VarChar, newToken);
    updateSessionRequest.input(idColumn, sql.Int, idValue);
    await updateSessionRequest.query(`
        UPDATE ${sessionTable}
        SET Token = @NewToken
        WHERE ${idColumn} = @${idColumn} AND Token = @OldToken;
    `);

    return newToken;
};

module.exports = {
    renewToken,
};
