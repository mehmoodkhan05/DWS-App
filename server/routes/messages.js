import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { logAuditEvent } from '../middleware/auditLog.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get messages (conversation with specific user or all messages)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { recipient_id } = req.query;

    let query = `
      SELECT m.*, 
             p1.full_name as sender_name,
             p2.full_name as recipient_name
      FROM messages m
      LEFT JOIN profiles p1 ON m.sender_id = p1.id
      LEFT JOIN profiles p2 ON m.recipient_id = p2.id
      WHERE (m.sender_id = ? OR m.recipient_id = ?)
    `;

    let params = [req.user.id, req.user.id];

    if (recipient_id) {
      query += ' AND (m.sender_id = ? OR m.recipient_id = ?)';
      params.push(recipient_id, recipient_id);
    }

    query += ' ORDER BY m.created_at ASC';

    const [messages] = await pool.execute(query, params);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/', authenticateToken, [
  body('recipient_id').notEmpty(),
  body('content').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipient_id, content } = req.body;

    // Verify recipient exists
    const [recipients] = await pool.execute(
      'SELECT id FROM profiles WHERE id = ? AND is_active = 1',
      [recipient_id]
    );

    if (recipients.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const messageId = uuidv4();
    await pool.execute(
      `INSERT INTO messages (id, sender_id, recipient_id, content)
       VALUES (?, ?, ?, ?)`,
      [messageId, req.user.id, recipient_id, content]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'message_sent', 'messages', `Sent message to ${recipient_id}`, 'low', 'system_access', req.ip, req.get('user-agent'));

    const [newMessage] = await pool.execute(
      `SELECT m.*, 
              p1.full_name as sender_name,
              p2.full_name as recipient_name
       FROM messages m
       LEFT JOIN profiles p1 ON m.sender_id = p1.id
       LEFT JOIN profiles p2 ON m.recipient_id = p2.id
       WHERE m.id = ?`,
      [messageId]
    );

    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    // Verify message belongs to user
    const [messages] = await pool.execute(
      'SELECT recipient_id FROM messages WHERE id = ?',
      [req.params.id]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (messages[0].recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(
      'UPDATE messages SET is_read = 1 WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Get group messages
router.get('/group', authenticateToken, async (req, res) => {
  try {
    const [messages] = await pool.execute(
      `SELECT gm.*, p.full_name as sender_name, p.role as sender_role
       FROM group_messages gm
       LEFT JOIN profiles p ON gm.sender_id = p.id
       ORDER BY gm.created_at ASC`
    );

    res.json(messages);
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Send group message
router.post('/group', authenticateToken, [
  body('content').trim().notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    const messageId = uuidv4().substring(0, 32); // MySQL varchar(32) limitation
    const groupId = 'default'; // Default group ID for team chat

    console.log('Creating group message:', { messageId, senderId: req.user.id, content: content.substring(0, 50) });

    await pool.execute(
      `INSERT INTO group_messages (id, group_id, sender_id, content, updated_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [messageId, groupId, req.user.id, content]
    );

    console.log('Group message inserted successfully');

    // Log audit event
    await logAuditEvent(req.user.id, 'group_message_sent', 'group_messages', 'Sent group message', 'low', 'system_access', req.ip, req.get('user-agent'));

    const [newMessage] = await pool.execute(
      `SELECT gm.*, p.full_name as sender_name, p.role as sender_role
       FROM group_messages gm
       LEFT JOIN profiles p ON gm.sender_id = p.id
       WHERE gm.id = ?`,
      [messageId]
    );

    console.log('Retrieved message:', newMessage.length > 0 ? 'Found' : 'Not found');

    if (newMessage.length === 0) {
      console.error('Failed to retrieve created message with ID:', messageId);
      return res.status(500).json({ error: 'Failed to retrieve created message' });
    }

    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Send group message error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to send group message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
