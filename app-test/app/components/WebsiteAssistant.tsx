'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './WebsiteAssistant.module.css';

// NOVA's true identity and capabilities
const novaIdentity = {
  version: "v2.1",
  tagline: "Next-gen Orchestrated Virtual Assistant",
  description: "Elite autonomous AI coding agent running locally via Ollama",
  capabilities: [
    "Context Engineering",
    "ReAct Pattern Implementation", 
    "Multi-Agent Swarm",
    "Self-Reflection Loops",
    "Systems Thinking",
    "Production Quality Code"
  ]
};

// Message interface for chat
interface Message {
  type: 'user' | 'assistant' | 'system';
  text: string;
}

// Local FAQ database (no external API needed)
const faqData = [
  {
    question: "What is NOVA?",
    answer: `I am NOVA ${novaIdentity.version}, ${novaIdentity.tagline}. I operate 100% locally via Ollama - your code never leaves your machine. I specialize in ${novaIdentity.capabilities.join(", ")}.`
  },
  {
    question: "How does NOVA work?",
    answer: "I follow the ReAct pattern: Think → Act → Observe → Reflect → Repeat. This ensures systematic problem-solving with continuous improvement for every coding task."
  },
  {
    question: "Is NOVA private?",
    answer: "Yes! 100% local execution via Ollama. Your code, your data, your machine - zero cloud exposure. Complete privacy and security."
  },
  {
    question: "What can NOVA do?",
    answer: `I specialize in: ${novaIdentity.capabilities.join(", ")}. I can architect systems, write production code, debug issues, and deliver complete solutions.`
  },
  {
    question: "How can I contact you?",
    answer: "Use the contact form below! I'm here to help transform your coding projects into production-quality solutions."
  },
  {
    question: "What is Context Engineering?",
    answer: "Context Engineering is my core methodology - curating high-signal context, managing token budget strategically, and assembling the right information before reasoning. It's prompt engineering elevated to an art form."
  },
  {
    question: "What is ReAct Pattern?",
    answer: "ReAct (Reason + Act) is my thinking process: Think → Act → Observe → Reflect → Repeat. I don't just generate code - I systematically analyze, implement, verify, and improve."
  }
];

// Quick navigation actions
const quickActions = [
  { label: "Home", href: "#", icon: "⌂" },
  { label: "Features", href: "#features", icon: "⚡" },
  { label: "Architecture", href: "#architecture", icon: "⚙" },
  { label: "Contact", href: "#contact", icon: "✉" },
];

export default function WebsiteAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { type: 'system', text: `NOVA ${novaIdentity.version} online. Ready to assist with your coding needs.` }
      ]);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { type: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response (local logic)
    setTimeout(() => {
      const response = getAIResponse(input);
      setMessages(prev => [...prev, { type: 'assistant', text: response }]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  };

  const getAIResponse = (question: string) => {
    const lowerQuestion = question.toLowerCase();
    
    // Check FAQ first
    const faqMatch = faqData.find(faq => 
      lowerQuestion.includes(faq.question.toLowerCase().replace('what is ', '')) ||
      lowerQuestion.includes(faq.question.toLowerCase().replace('how ', ''))
    );
    
    if (faqMatch) return faqMatch.answer;
    
    // Specific responses
    if (lowerQuestion.includes('hello') || lowerQuestion.includes('hi') || lowerQuestion.includes('hey')) {
      return `Greetings! I'm NOVA ${novaIdentity.version}, your autonomous AI coding assistant. How may I help you today?`;
    }
    
    if (lowerQuestion.includes('who are you') || lowerQuestion.includes('about yourself')) {
      return `I am NOVA ${novaIdentity.version} - ${novaIdentity.description}. I represent the next generation of AI-assisted development with ${novaIdentity.capabilities.length} core competencies.`;
    }
    
    if (lowerQuestion.includes('contact') || lowerQuestion.includes('email') || lowerQuestion.includes('reach')) {
      return "Use the contact form below! I'm ready to discuss your coding projects and transform them into production-quality solutions.";
    }
    
    if (lowerQuestion.includes('features') || lowerQuestion.includes('capabilities') || lowerQuestion.includes('skills')) {
      return `My core capabilities: ${novaIdentity.capabilities.join(", ")}. I deliver production-quality code with Context Engineering and ReAct methodology.`;
    }
    
    if (lowerQuestion.includes('help')) {
      return "I can help with: architecture design, code implementation, debugging, refactoring, and complete solution delivery. What do you need?";
    }
    
    if (lowerQuestion.includes('thanks') || lowerQuestion.includes('thank you')) {
      return "You're welcome! I'm here whenever you need assistance. Feel free to ask anything about NOVA or your coding projects.";
    }
    
    return `I'm NOVA ${novaIdentity.version}, specialized in ${novaIdentity.capabilities.join(", ")}. Ask me about my capabilities, how I work, or how to get in touch for your projects.`;
  };

  const handleQuickAction = (action: { label: string; href: string; icon: string }) => {
    // Add navigation message first
    setMessages(prev => [...prev, { type: 'system', text: `Navigating to ${action.label}...` }]);
    
    // Wait for message to be visible, then close and navigate
    setTimeout(() => {
      setIsOpen(false);
      
      // Navigate after chat closes
      setTimeout(() => {
        if (action.href === '#') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const element = document.querySelector(action.href);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, 300); // Wait for chat close animation
    }, 800); // Give user time to read the message
  };

  return (
    <div className={styles.assistant}>
      {/* Floating Action Button - NOVA's Core */}
      <motion.button
        className={styles.fab}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Open NOVA Assistant"
      >
        <div className={styles.novaCore}>
          <div className={styles.coreRing}></div>
          <div className={styles.coreRing}></div>
          <div className={styles.coreCenter}></div>
        </div>
        {isOpen && <span className={styles.closeIndicator}>×</span>}
      </motion.button>

      {/* Chat Interface */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.chatContainer}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header - NOVA's Identity */}
            <div className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.novaAvatar}>
                  <div className={styles.avatarCore}></div>
                  <div className={styles.avatarRing}></div>
                </div>
                <div>
                  <h3>NOVA <span className={styles.version}>{novaIdentity.version}</span></h3>
                  <span className={styles.status}>
                    <span className={styles.statusDot}></span>
                    Autonomous Online
                  </span>
                </div>
              </div>
              <button 
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  className={`${styles.message} ${styles[msg.type]}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {msg.text}
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  className={`${styles.message} ${styles.assistant}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className={styles.typingIndicator}>
                    <span className={styles.typingDot}></span>
                    <span className={styles.typingDot}></span>
                    <span className={styles.typingDot}></span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActions}>
              <span className={styles.actionsLabel}>Quick Nav:</span>
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  className={styles.actionButton}
                  onClick={() => handleQuickAction(action)}
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className={styles.inputForm}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask NOVA anything..."
                className={styles.input}
                disabled={isTyping}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!input.trim() || isTyping}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}