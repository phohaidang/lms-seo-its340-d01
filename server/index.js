import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import quizRoutes from './routes/quizzes.js';
import ebookRoutes from './routes/ebook.js';
import examRoutes from './routes/exams.js';
import gradeRoutes from './routes/grades.js';
import evidenceRoutes from './routes/evidence.js';
import feedbackRoutes from './routes/feedback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Static files
app.use('/lessons', express.static(join(__dirname, '..', 'client', 'public', 'lessons')));
app.use('/slides', express.static(join(__dirname, '..', 'client', 'public', 'slides')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ebook', ebookRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/feedback', feedbackRoutes);

// Root route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5;">
        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
          <h1 style="color: #1a73e8;">LMS Hub API — ${process.env.COURSE_CODE}</h1>
          <p>Server is running on port ${PORT}</p>
          <hr style="margin: 1.5rem 0; border: 0; border-top: 1px solid #eee;">
          <p>To access the user interface, please visit:</p>
          <a href="http://localhost:5173" style="display: inline-block; background: #1a73e8; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Frontend (Port 5173)</a>
        </div>
      </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    course: process.env.COURSE_CODE,
    name: process.env.COURSE_NAME,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║         LMS Hub — ${process.env.COURSE_CODE}                  ║
  ║         ${process.env.COURSE_NAME}              ║
  ║         http://localhost:${PORT}                  ║
  ╚═══════════════════════════════════════════════╝
    `);
  });
}

export default app;
