import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../services/socketService';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUser: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, currentUser }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isCurrentUser = (sender: string) => {
    return sender === currentUser;
  };

  const isSystemMessage = (sender: string) => {
    return sender === 'System';
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>💬 Chat</h3>
        <span className="message-count">{messages.length} messages</span>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation! 👋</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${
                isCurrentUser(message.sender) ? 'own-message' : 
                isSystemMessage(message.sender) ? 'system-message' : 'other-message'
              }`}
            >
              {isSystemMessage(message.sender) ? (
                <div className="system-content">
                  <span className="system-text">{message.message}</span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
              ) : (
                <>
                  <div className="message-header">
                    <span className="sender-name">
                      {isCurrentUser(message.sender) ? 'You' : message.sender}
                    </span>
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="message-content">
                    {message.message}
                  </div>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-group">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="chat-input"
            maxLength={500}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="send-btn"
          >
            📤
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;