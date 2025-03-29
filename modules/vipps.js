require('dotenv').config();
const crypto = require('crypto');

const authVippsWebhook = (req, res, next) => {
    const headers = req.headers;
    const receivedSignature = headers['authorization'];

    if (!receivedSignature) {
        return res.status(401).send('Missing Vipps signature');
    }

    const secret = process.env.VIPPS_WEBHOOK_SECRET;
    const method = req.method;
    const pathAndQuery = req.originalUrl;
    const xMsDate = headers['x-ms-date'];
    const xMsContentSha256 = headers['x-ms-content-sha256'];
    const host = headers['host'];

    const expectedSignedString = `${method}\n` + `${pathAndQuery}\n` + `${xMsDate};${host};${xMsContentSha256}`;

    const computedSignature = crypto.createHmac('sha256', secret).update(expectedSignedString).digest('base64');

    const expectedAuth = `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${computedSignature}`;
    const receivedSignatureValue = receivedSignature.trim();

    if (expectedAuth === receivedSignatureValue) {
        console.log('Webhook authenticated successfully');
        return next();
    } else {
        console.log('Invalid Vipps signature');
        return res.status(401).send('Unauthorized');
    }
};

const vippsPaymentCreated = async (paymentId) => {
    console.log(`Payment created: ${paymentId}`);
    // Implement your logic, e.g., update database
};

const vippsPaymentAborted = async (paymentId) => {
    console.log(`Payment aborted: ${paymentId}`);
    // Implement logic
};

const vippsPaymentExpired = async (paymentId) => {
    console.log(`Payment expired: ${paymentId}`);
    // Implement logic
};

const vippsPaymentCancelled = async (paymentId) => {
    console.log(`Payment cancelled: ${paymentId}`);
    // Implement logic
};

const vippsPaymentCaptured = async (paymentId) => {
    console.log(`Payment captured: ${paymentId}`);
    // Implement logic
};

const vippsPaymentRefunded = async (paymentId) => {
    console.log(`Payment refunded: ${paymentId}`);
    // Implement logic
};

const vippsPaymentAuthorized = async (paymentId) => {
    console.log(`Payment authorized: ${paymentId}`);
    // Implement logic
};

const vippsPaymentTerminated = async (paymentId) => {
    console.log(`Payment terminated: ${paymentId}`);
    // Implement logic
};

const vippsAgreementActivated = async (agreementId) => {
    console.log(`Agreement activated: ${agreementId}`);
};

const vippsAgreementRejected = async (agreementId) => {
    console.log(`Agreement rejected: ${agreementId}`);
};

const vippsAgreementStopped = async (agreementId) => {
    console.log(`Agreement stopped: ${agreementId}`);
};

const vippsAgreementExpired = async (agreementId) => {
    console.log(`Agreement expired: ${agreementId}`);
};


module.exports = { 
    authVippsWebhook,
    vippsPaymentCreated,
    vippsPaymentAborted,
    vippsPaymentExpired,
    vippsPaymentCancelled,
    vippsPaymentCaptured,
    vippsPaymentRefunded,
    vippsPaymentAuthorized,
    vippsPaymentTerminated,
    vippsAgreementActivated,
    vippsAgreementRejected,
    vippsAgreementStopped,
    vippsAgreementExpired,
};
