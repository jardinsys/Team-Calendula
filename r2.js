const { S3Client } = require("@aws-sdk/client-s3");
const config = require("./config.json");

const trigR2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.trigin.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.trigin.keyID,
        secretAccessKey: config.r2.trigin.key
    }
});

const sysDiscR2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.system.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.system.discord.accessKeyId,
        secretAccessKey: config.r2.system.discord.secretAccessKey
    }
});

const sysAppR2 = new S3Client({ 
    region: "auto",
    endpoint: `https://${config.r2.system.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.system.app.accessKeyId,
        secretAccessKey: config.r2.system.app.secretAccessKey
    }
});

module.exports = { trigR2, sysDiscR2, sysAppR2 };