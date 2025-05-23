const sql = require('mssql');

const config = {
    user: process.env.DB_USER || '',// Add your Database username here
    password: process.env.DB_PASS || '',// Add your Database password here
    server: '', // Replace with your actual server hostname or domain
    database: '',// Add Databse name 
    options: {
        encrypt: true, // Use true if you're on Azure or need encrypted connection
        trustServerCertificate: true, // Use true if you're on a trusted network
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};


// Create SQL connection pool
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('SQL connection error', err.stack);
        process.exit(1); // Exit process on connection failure
    });

module.exports = {
    sql,
    poolPromise
};
