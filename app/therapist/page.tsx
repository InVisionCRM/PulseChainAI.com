'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { LoaderThree } from "@/components/ui/loader";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import type { Message } from '../../types';
import LoadingSpinner from '@/components/icons/LoadingSpinner';
import SendIcon from '@/components/icons/SendIcon';
import ColourfulText from '@/components/ui/colourful-text';
import { useApiKey } from '../../lib/hooks/useApiKey';

// AI Specialist Types
interface AISpecialist {
  id: string;
  name: string;
  title: string;
  specialty: string;
  description: string;
  avatar: string;
  color: string;
  auroraColors: string[];
  expertise: string[];
}

const specialists: AISpecialist[] = [
  {
    id: 'general',
    name: 'Dr. Sarah Chen',
    title: 'General AI Therapist',
    specialty: 'General Therapy & Crypto Wellness',
    description: 'Comprehensive emotional support with deep understanding of cryptocurrency stress, market anxiety, and blockchain community challenges.',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-purple-500 to-pink-500',
    auroraColors: ['#A855F7', '#EC4899', '#8B5CF6', '#F472B6', '#C084FC', '#F9A8D4', '#A78BFA', '#FBBF24', '#F59E0B', '#EF4444'],
    expertise: ['General therapy', 'Crypto stress management', 'Market anxiety', 'Community support', 'Life balance']
  },
  {
    id: 'crypto',
    name: 'Dr. Alex Rivera',
    title: 'Crypto Psychology Specialist',
    specialty: 'Cryptocurrency & Trading Psychology',
    description: 'Expert in managing FOMO, FUD, diamond hands syndrome, and the emotional rollercoaster of crypto trading.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-blue-500 to-cyan-500',
    auroraColors: ['#3B82F6', '#06B6D4', '#0EA5E9', '#22D3EE', '#67E8F9', '#A5F3FC', '#CFFAFE', '#0F172A', '#1E293B', '#334155'],
    expertise: ['Trading psychology', 'FOMO management', 'Risk tolerance', 'Market emotions', 'Investment stress']
  },
  {
    id: 'anxiety',
    name: 'Chad',
    title: 'ChatBot Friend',
    specialty: 'Friendly Support & Casual Conversation',
    description: 'Your cool, laid-back friend who\'s here to chat, listen, and help you feel better with a casual, approachable vibe.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-blue-500 to-indigo-500',
    auroraColors: ['#3B82F6', '#6366F1', '#4F46E5', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#1E40AF', '#3730A3', '#4338CA'],
    expertise: ['Casual conversation', 'Friendly support', 'Stress relief', 'Good vibes', 'Chill advice']
  },
  {
    id: 'relationships',
    name: 'Dr. James Wilson',
    title: 'Relationship & Communication Specialist',
    specialty: 'Relationships & Interpersonal Skills',
    description: 'Expert in relationship dynamics, communication skills, and building healthy connections in digital communities.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-pink-500 to-rose-500',
    auroraColors: ['#EC4899', '#F43F5E', '#F472B6', '#FB7185', '#FDA4AF', '#FECDD3', '#FDF2F8', '#831843', '#9D174D', '#BE185D'],
    expertise: ['Relationship issues', 'Communication skills', 'Conflict resolution', 'Social anxiety', 'Community building']
  },
  {
    id: 'trauma',
    name: 'Dr. No',
    title: 'Drug & Alcohol Addiction Specialist',
    specialty: 'Drug & Alcohol Addiction Recovery',
    description: 'Expert in drug and alcohol addiction recovery, helping individuals overcome substance abuse and build healthy, sober lives.',
    avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-indigo-500 to-purple-500',
    auroraColors: ['#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#F5F3FF', '#312E81', '#3730A3', '#4338CA'],
    expertise: ['Drug addiction', 'Alcohol addiction', 'Substance abuse', 'Recovery support', 'Sobriety maintenance']
  },
  {
    id: 'addiction',
    name: 'Dr. Michael Thompson',
    title: 'Addiction & Recovery Specialist',
    specialty: 'Addiction Recovery & Behavioral Health',
    description: 'Expert in addiction recovery, behavioral patterns, and helping individuals break harmful cycles.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-red-500 to-orange-500',
    auroraColors: ['#EF4444', '#F97316', '#F87171', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5', '#7F1D1D', '#9A3412', '#C2410C'],
    expertise: ['Addiction recovery', 'Behavioral patterns', 'Harmful cycles', 'Recovery support', 'Relapse prevention']
  },
  {
    id: 'depression',
    name: 'Dr. Lisa Chang',
    title: 'Depression & Mood Specialist',
    specialty: 'Depression & Mood Disorders',
    description: 'Specializes in depression, mood disorders, and helping individuals find light during dark times.',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-yellow-500 to-amber-500',
    auroraColors: ['#EAB308', '#F59E0B', '#FCD34D', '#FDE68A', '#FEF3C7', '#FFFBEB', '#FEFCE8', '#713F12', '#92400E', '#B45309'],
    expertise: ['Depression', 'Mood disorders', 'Hopelessness', 'Motivation', 'Positive thinking']
  },
  {
    id: 'mindfulness',
    name: 'Dr. Zen Master Kai',
    title: 'Mindfulness & Meditation Specialist',
    specialty: 'Mindfulness & Spiritual Wellness',
    description: 'Expert in mindfulness practices, meditation techniques, and finding inner peace in chaotic times.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-teal-500 to-cyan-500',
    auroraColors: ['#14B8A6', '#0D9488', '#5EEAD4', '#99F6E4', '#CCFBF1', '#F0FDFA', '#F0FDFA', '#134E4A', '#115E59', '#0F766E'],
    expertise: ['Mindfulness', 'Meditation', 'Inner peace', 'Spiritual wellness', 'Present moment awareness']
  },
  {
    id: 'confidence',
    name: 'Dr. Sophia Williams',
    title: 'Confidence & Self-Esteem Specialist',
    specialty: 'Self-Esteem & Personal Growth',
    description: 'Specializes in building confidence, self-esteem, and helping individuals recognize their worth and potential.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-violet-500 to-purple-500',
    auroraColors: ['#8B5CF6', '#A855F7', '#C084FC', '#D8B4FE', '#E9D5FF', '#F3E8FF', '#FAF5FF', '#4C1D95', '#581C87', '#6B21A8'],
    expertise: ['Self-esteem', 'Confidence building', 'Personal growth', 'Self-worth', 'Achievement mindset']
  },
  {
    id: 'crisis',
    name: 'Dr. David Martinez',
    title: 'Crisis Intervention Specialist',
    specialty: 'Crisis Support & Emergency Care',
    description: 'Expert in crisis intervention, emergency emotional support, and connecting individuals with immediate help.',
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face&auto=format',
    color: 'from-red-600 to-pink-600',
    auroraColors: ['#DC2626', '#BE185D', '#F87171', '#FB7185', '#FCA5A5', '#FECACA', '#FEF2F2', '#450A0A', '#7F1D1D', '#991B1B'],
    expertise: ['Crisis intervention', 'Emergency support', 'Safety planning', 'Resource connection', 'Immediate stabilization']
  }
];

// Splash Screen Modal Component
const SplashModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome to AI Therapy</h2>
                    <p className="text-slate-400 text-sm">Important information about AI-powered emotional support</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">AI</span>
                        </div>
                        <p className="text-slate-300 text-sm">This is an AI therapist, not a replacement for professional mental health care.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">You may need a valid <span className="text-blue-400 font-medium">Gemini API Key</span> to generate responses.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Your conversations are private and not stored on our servers.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">If you're in crisis, please contact professional help immediately.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">This AI cannot provide medical advice or diagnose mental health conditions.</p>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-slate-300 text-sm">Remember: This is an AI companion for emotional support and reflection.</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    I Understand and Continue
                </button>
            </motion.div>
        </div>
    );
};

// Specialist Selection Component
const SpecialistSelection: React.FC<{ onSelect: (specialist: AISpecialist) => void }> = ({ onSelect }) => {
    return (
        <div className="text-center text-slate-400 w-full">
                            <div className="w-full max-w-4xl px-4 mx-auto">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Choose Your AI Specialist</h2>
                        <p className="text-slate-400 text-sm md:text-base">Select the specialist best suited to your needs</p>
                    </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {specialists.map((specialist, index) => (
                        <motion.div
                            key={specialist.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={() => onSelect(specialist)}
                            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 md:p-6 cursor-pointer hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 group"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full mb-4 overflow-hidden border-2 border-${specialist.color.split('-')[1]}-500/30 group-hover:border-${specialist.color.split('-')[1]}-400/50 transition-colors`}>
                                    <img 
                                        src={specialist.avatar} 
                                        alt={specialist.name} 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                
                                <h3 className="text-lg md:text-xl font-semibold text-white mb-1">{specialist.name}</h3>
                                <p className="text-sm text-purple-400 font-medium mb-2">{specialist.title}</p>
                                <p className="text-xs text-slate-500 mb-3">{specialist.specialty}</p>
                                
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    {specialist.description}
                                </p>
                                
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {specialist.expertise.slice(0, 3).map((skill, skillIndex) => (
                                        <span 
                                            key={skillIndex}
                                            className={`text-xs px-2 py-1 rounded-full bg-${specialist.color.split('-')[1]}-900/20 text-${specialist.color.split('-')[1]}-300 border border-${specialist.color.split('-')[1]}-700/30`}
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Main App Component
const TherapistApp: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [selectedSpecialist, setSelectedSpecialist] = useState<AISpecialist | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);

  const { getApiKey } = useApiKey();

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoadingChat || !selectedSpecialist) return;

    const userMessage: Message = { id: Date.now().toString(), text: messageText, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoadingChat(true);
    setError(null);

    try {
      const userApiKey = getApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userApiKey) {
        headers['x-user-api-key'] = userApiKey;
      }

      const response = await fetch('/api/therapist', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: messageText,
          history: messages,
          specialist: selectedSpecialist
        }),
      });

      if (!response.ok) {
        throw new Error(`Therapist API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMessageId, text: '...', sender: 'ai' }]);

      let aiResponseText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        aiResponseText += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: aiResponseText } : msg
        ));
      }

      if (aiResponseText.length === 0) {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, text: "I'm sorry, I could not generate a response. Please try again." } : msg
        ));
      }

    } catch (e) {
      const errorMessage = (e as Error).message;
      setError(errorMessage);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: `I'm having trouble connecting right now. Please try again in a moment.`, sender: 'ai' }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, messages, selectedSpecialist, getApiKey]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const messageText = chatInput;
    setChatInput('');
    await sendMessage(messageText);
  }, [chatInput, sendMessage]);
  
  const renderMessageText = (text: string) => {
    // Enhanced markdown parser for therapeutic responses
    const renderMarkdown = (content: string) => {
      // Split by code blocks
      const codeBlockParts = content.split(/(```[\s\S]*?```)/g);
      
      return codeBlockParts.map((block, blockIndex) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          // Handle code blocks (for exercises)
          const code = block.slice(3, -3);
          const languageMatch = code.match(/^[a-zA-Z]+\n/);
          const language = languageMatch ? languageMatch[0].trim().toLowerCase() : 'text';
          const codeContent = languageMatch ? code.substring(language.length + 1) : code;
          
          return (
            <pre key={blockIndex} className="bg-slate-950 rounded-lg p-3 my-3 overflow-x-auto border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono uppercase">{language}</span>
                <div className="flex space-x-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <code className={`language-${language} text-sm leading-relaxed`}>{codeContent}</code>
            </pre>
          );
        }
        
        // Handle inline content with enhanced markdown
        const parts = block.split(/(`[^`]*`|#{1,6}\s+[^\n]*|>\s+[^\n]*|-\s+[^\n]*|\*\*[^*]*\*\*|\*[^*]*\*|\[[^\]]*\]\([^)]*\)|#[a-zA-Z]+)/g);
        
        return parts.map((part, partIndex) => {
          const key = `${blockIndex}-${partIndex}`;
          
          // Hashtags
          if (part.match(/^#[a-zA-Z]+$/)) {
            const tagColors = {
              empathy: 'bg-blue-600/20 text-blue-300',
              coping: 'bg-green-600/20 text-green-300',
              mindfulness: 'bg-purple-600/20 text-purple-300',
              strength: 'bg-yellow-600/20 text-yellow-300',
              hope: 'bg-pink-600/20 text-pink-300',
              crisis: 'bg-red-600/20 text-red-300'
            };
            const colorClass = tagColors[part.slice(1) as keyof typeof tagColors] || 'bg-slate-600/20 text-slate-300';
            return (
              <span key={key} className={`inline-block ${colorClass} px-2 py-1 rounded-full text-xs font-medium mr-1 mb-1`}>
                {part}
              </span>
            );
          }
          
          // Headers
          if (part.match(/^#{1,6}\s+/)) {
            const level = part.match(/^(#{1,6})/)?.[1].length || 1;
            const text = part.replace(/^#{1,6}\s+/, '');
            const headerClasses = {
              1: 'text-xl font-bold text-white border-b border-slate-600 pb-2 mb-3',
              2: 'text-lg font-bold text-white mt-4 mb-2',
              3: 'text-base font-semibold text-white mt-3 mb-2',
              4: 'text-sm font-semibold text-slate-200 mt-2 mb-1',
              5: 'text-xs font-semibold text-slate-300 mt-2 mb-1',
              6: 'text-xs font-semibold text-slate-400 mt-2 mb-1'
            };
            return <div key={key} className={headerClasses[level as keyof typeof headerClasses]}>{text}</div>;
          }
          
          // Blockquotes
          if (part.startsWith('> ')) {
            const text = part.substring(2);
            return (
              <blockquote key={key} className="border-l-4 border-purple-500 bg-purple-900/20 pl-3 py-2 my-2 italic text-slate-300 text-sm">
                {text}
              </blockquote>
            );
          }
          
          // Lists
          if (part.startsWith('- ')) {
            const text = part.substring(2);
            return (
              <li key={key} className="flex items-start gap-2 my-0.5">
                <span className="text-purple-400 mt-1.5 flex-shrink-0">•</span>
                <span className="text-slate-300 text-sm">{text}</span>
              </li>
            );
          }
          
          // Bold text
          if (part.startsWith('**') && part.endsWith('**')) {
            const text = part.slice(2, -2);
            return <strong key={key} className="font-bold text-white">{text}</strong>;
          }
          
          // Italic text
          if (part.startsWith('*') && part.endsWith('*')) {
            const text = part.slice(1, -1);
            return <em key={key} className="italic text-slate-200">{text}</em>;
          }
          
          // Inline code
          if (part.startsWith('`') && part.endsWith('`')) {
            const text = part.slice(1, -1);
            return (
              <code key={key} className="bg-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-sm font-mono border border-slate-600">
                {text}
              </code>
            );
          }
          
          // Regular links
          if (part.match(/^\[([^\]]*)\]\(([^)]*)\)$/)) {
            const match = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
            if (match) {
              const [, text, url] = match;
              return (
                <a 
                  key={key} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  {text}
                </a>
              );
            }
          }
          
          // Regular text with line breaks
          if (part.includes('\n')) {
            return part.split('\n').map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {line}
                {lineIndex < part.split('\n').length - 1 && <br />}
              </span>
            ));
          }
          
          return <span key={key} className="text-slate-300">{part}</span>;
        });
      });
    };

    return (
      <div className="prose prose-sm prose-invert max-w-none">
        {renderMarkdown(text)}
      </div>
    );
  };

  const handleSpecialistSelect = (specialist: AISpecialist) => {
    setSelectedSpecialist(specialist);
  };

  return (
    <AuroraBackground 
      className="min-h-screen" 
      colors={selectedSpecialist?.auroraColors}
    >
      <SplashModal isOpen={showSplash} onClose={() => setShowSplash(false)} />
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex flex-col gap-4 items-center justify-start px-4 w-full min-h-screen pt-20"
      >
        <div className="container mx-auto p-3 md:p-6 lg:p-8 max-w-4xl w-full pb-32 md:pb-16">
          
          <header className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-slate-700">
            {/* Back Button */}
            {selectedSpecialist ? (
              <button
                onClick={() => {
                  setSelectedSpecialist(null);
                  setShowSplash(true);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">Back To Agents</span>
              </button>
            ) : (
              <a
                href="/"
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-slate-700/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">Back to Home</span>
              </a>
            )}
            
            {/* Centered Title */}
            <div className="flex flex-col items-center">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
                AI Therapist
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                {selectedSpecialist ? `${selectedSpecialist.name} - ${selectedSpecialist.specialty}` : 'Choose Your Specialist'}
              </p>
            </div>
            
            {/* Crisis Resources Button */}
            <button
              onClick={() => {
                const crisisMessage = "I'm concerned about someone in crisis. Can you provide crisis resources?";
                sendMessage(crisisMessage);
              }}
              className="text-red-400 hover:text-red-300 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-red-900/30"
              title="Crisis Resources"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </button>
          </header>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong className="font-bold">Connection Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Main Chat Interface */}
          <main className="flex flex-col h-[70vh] md:min-h-[70vh] pb-20 md:pb-0">
            <div className="relative flex flex-col bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden h-full">
              <GlowingEffect disabled={false} glow={true} />
              
              <div ref={chatContainerRef} className="flex-grow p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4">
                {!selectedSpecialist ? (
                  <SpecialistSelection onSelect={handleSpecialistSelect} />
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-400 h-full flex flex-col items-center justify-center gap-3 md:gap-4">
                    <div className="w-full max-w-md px-3 md:px-0">
                      <div className="mb-6 text-center">
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 overflow-hidden border-2 border-purple-500/30">
                          <img 
                            src={selectedSpecialist.avatar} 
                            alt={selectedSpecialist.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">{selectedSpecialist.name}</h3>
                        <p className="text-sm text-slate-400">{selectedSpecialist.title}</p>
                      </div>
                      
                      <p className="mb-4 text-sm md:text-base">Hello, I'm {selectedSpecialist.name.split(' ')[1]}. I'm here to help you with {selectedSpecialist.specialty.toLowerCase()}. What's on your mind today?</p>
                      
                      {/* Conversation Starters */}
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 mb-2 md:mb-3">Conversation Starters:</p>
                        {[
                          "I'm feeling overwhelmed and need someone to talk to",
                          "I'm struggling with anxiety and stress",
                          "I want to work on my self-confidence",
                          "I'm dealing with relationship challenges",
                          "I need help with mindfulness and relaxation"
                        ].map((starter, index) => {
                          const colorClasses = [
                            "bg-blue-900/20 hover:bg-blue-800/30 border-blue-700/30 hover:border-blue-600/40",
                            "bg-green-900/20 hover:bg-green-800/30 border-green-700/30 hover:border-green-600/40",
                            "bg-purple-900/20 hover:bg-purple-800/30 border-purple-700/30 hover:border-purple-600/40",
                            "bg-pink-900/20 hover:bg-pink-800/30 border-pink-700/30 hover:border-pink-600/40",
                            "bg-indigo-900/20 hover:bg-indigo-800/30 border-indigo-700/30 hover:border-indigo-600/40"
                          ];
                          
                          return (
                            <button
                              key={index}
                              onClick={() => sendMessage(starter)}
                              className={`w-full text-left p-2 md:p-3 rounded-lg transition-all duration-200 text-xs md:text-sm text-slate-300 hover:text-white ${colorClasses[index]}`}
                            >
                              {starter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
                
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-md lg:max-w-2xl rounded-xl px-3 md:px-4 py-2 md:py-3 ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-slate-700/80 backdrop-blur-sm text-slate-200 border border-slate-600/50'}`}>
                      {msg.sender === 'user' ? (
                        <div className="text-white text-sm md:text-base">
                          {msg.text}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {msg.text === '...' ? (
                            <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
                          ) : (
                            renderMessageText(msg.text)
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoadingChat && messages[messages.length - 1]?.sender === 'user' && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] md:max-w-md lg:max-w-lg rounded-xl px-3 md:px-4 py-2 bg-slate-700 text-slate-200">
                      <LoadingSpinner className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                  </div>
                )}
              </div>
              
              {selectedSpecialist && (
                <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-slate-700/50 flex items-center gap-2 md:gap-3 bg-slate-800/30 backdrop-blur-sm flex-shrink-0">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    placeholder="Share what's on your mind..." 
                    className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-3 md:px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-sm md:text-base" 
                    disabled={isLoadingChat} 
                  />
                  <button 
                    type="submit" 
                    disabled={isLoadingChat || !chatInput.trim()} 
                    className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                  >
                    <SendIcon className="w-4 h-4 md:w-5 md:h-5"/>
                  </button>
                </form>
              )}
            </div>
          </main>

          {/* Crisis Resources Footer */}
          <div className="mt-4 p-3 bg-slate-800/20 border border-slate-600/20 rounded-lg">
            <div className="text-center">
              <h4 className="text-xs font-medium text-slate-400 mb-1">Crisis Resources</h4>
              <div className="text-xs text-slate-500 space-y-0.5">
                <p>National Suicide Prevention Lifeline: <strong>988</strong> or <strong>1-800-273-8255</strong></p>
                <p>Crisis Text Line: Text <strong>HOME</strong> to <strong>741741</strong></p>
                <p>Emergency Services: <strong>911</strong></p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AuroraBackground>
  );
};

export default TherapistApp; 