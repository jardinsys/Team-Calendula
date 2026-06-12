const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

function uploadMiddleware(fieldName) {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File too large. Maximum 8MB.' });
                }
                if (err.message === 'Only image files are allowed') {
                    return res.status(400).json({ error: 'Only image files are allowed.' });
                }
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    };
}

module.exports = { upload, uploadMiddleware };