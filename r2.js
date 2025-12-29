import {  S3Client } from "@aws-sdk/client-s3";
const config = require("./config.json");

export const trigR2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.trigin.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.trigin.keyID,
        secretAccessKey: config.r2.trigin.key
    }
});

export const sysDiscR2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.system.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.system.keyID.discord,
        secretAccessKey: config.r2.system.key.discord
    }
});

export const sysAppR2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.system.accountID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.system.keyID.app,
        secretAccessKey: config.r2.system.key.app
    }
});