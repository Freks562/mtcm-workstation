/**
 * Federal Routes - Federal Kit downloads
 * Provides file listing and download functionality
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const DOWNLOADS_DIR = path.join(__dirname, '../../public/downloads');

// Federal kit page
router.get('/', (req, res) => {
  res.render('federal', { 
    title: 'Federal Resources',
    user: req.user
  });
});

// List available downloads
router.get('/downloads', (req, res) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(DOWNLOADS_DIR)
      .filter(file => !file.startsWith('.'))
      .map(file => {
        const stats = fs.statSync(path.join(DOWNLOADS_DIR, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime
        };
      });
    
    res.json({ files });
  } catch (error) {
    console.error('Error listing downloads:', error);
    res.status(500).json({ error: 'Failed to list downloads' });
  }
});

// Download specific file
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(DOWNLOADS_DIR, filename);
  
  // Verify file is within downloads directory (extra safety)
  const resolvedPath = path.resolve(filepath);
  const resolvedDownloadsDir = path.resolve(DOWNLOADS_DIR);
  if (!resolvedPath.startsWith(resolvedDownloadsDir)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.download(filepath);
});

// Download all as ZIP
router.get('/download-all', (req, res) => {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    return res.status(404).json({ error: 'No files available' });
  }
  
  const files = fs.readdirSync(DOWNLOADS_DIR).filter(file => !file.startsWith('.'));
  
  if (files.length === 0) {
    return res.status(404).json({ error: 'No files available' });
  }
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=federal-kit.zip');
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    }
  });
  
  archive.pipe(res);
  
  for (const file of files) {
    archive.file(path.join(DOWNLOADS_DIR, file), { name: file });
  }
  
  archive.finalize();
});

module.exports = router;
