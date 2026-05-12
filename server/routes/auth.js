import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/sheets.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new student account
 */
router.post('/register', async (req, res) => {
  try {
    const { student_id, email, full_name, password } = req.body;
    
    // Validation
    if (!student_id || !email || !full_name || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }
    
    // Check email domain
    const domain = process.env.ALLOWED_EMAIL_DOMAIN;
    if (domain && !email.endsWith(`@${domain}`)) {
      return res.status(400).json({ error: `Email phải có đuôi @${domain}` });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    
    // Check duplicate
    const existing = await db.findOne('students', s => s.email === email || s.student_id === student_id);
    if (existing) {
      return res.status(409).json({ error: 'Email hoặc MSSV đã được đăng ký' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      student_id,
      email,
      full_name,
      password_hash,
      role: 'student',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };
    
    await db.append('students', user);
    
    // Generate JWT
    const token = jwt.sign(
      { student_id, email, full_name, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    res.status(201).json({
      message: 'Đăng ký thành công!',
      token,
      user: { student_id, email, full_name, role: 'student' }
    });
    
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' });
  }
});

/**
 * POST /api/auth/login
 * Login with email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }
    
    // Find user
    const user = await db.findOne('students', s => s.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    
    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    
    // Update last login
    await db.update('students', s => s.email === email, {
      last_login: new Date().toISOString()
    });
    
    // Generate JWT
    const token = jwt.sign(
      {
        student_id: user.student_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: {
        student_id: user.student_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        must_change_password: !!user.must_change_password
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' });
  }
});

/**
 * POST /api/auth/change-password
 * Change current user password
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }
    
    const user = await db.findOne('students', s => s.student_id === req.user.student_id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    }
    
    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    
    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear flag
    await db.update('students', s => s.student_id === req.user.student_id, {
      password_hash,
      must_change_password: false
    });
    
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.findOne('students', s => s.email === req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    }
    
    res.json({
      student_id: user.student_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      must_change_password: !!user.must_change_password,
      created_at: user.created_at,
      last_login: user.last_login
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

export default router;
