const fs = require('fs').promises;
const path = require('path');

async function checkFileExists(filePath) {
    try {
        const resolvedPath = path.resolve(filePath);
        console.log('Resolved File Path:', resolvedPath);
        await fs.access(resolvedPath, fs.constants.F_OK);
        return true;
    } catch (err) {
        console.log(`File does not exist: ${filePath}`);
        return false;
    }
}

const filePath = path.join(__dirname, '../../invoices', 'order_no_1651.pdf');  
checkFileExists(filePath).then(exists => console.log(exists ? 'File found' : 'File not found'));
