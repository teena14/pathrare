'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, PlusCircle, MessageSquare, AlertTriangle, 
  HelpCircle, Share2, Heart, Award, ShieldCheck, ChevronRight,
  Send, AlertCircle, X, Trash2
} from 'lucide-react';

import { useAuth } from '@/providers/auth-provider';
import { db } from '@/services/firebase/firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, deleteDoc, getDoc, setDoc
} from 'firebase/firestore';

// --- TYPES ---

type UserContext = {
  role: string;
  condition: string;
  experience: string;
};

type PostType = 'Experience' | 'Question' | 'Resource' | 'Emergency Insight';

interface Reply {
  id: string; 
  content: string;
  authorName: string;
  authorUid: string;
  timestamp: string; 
  createdAt: number; 
}

interface Post {
  id: string;  
  authorName: string;
  authorUid: string;
  context: UserContext;
  content: string;
  type: PostType;
  tags: string[];
  likes: string[]; 
  replies: Reply[];
  timestamp: string;
  createdAt: any; 
  isVerified?: boolean;
  verifiedBy?: string;
}

interface Circle {
  id: string;
  name: string;
  description: string;
  members: string[]; // Track joined UIDs
}

const initializeCirclesData: Circle[] = [
  { id: 'c1', name: 'Swelling + Vascular Anomalies', description: 'Managing severe fluid retention and vascular issues.', members: [] },
  { id: 'c2', name: 'Parents: Early-stage Diagnosis', description: 'Navigating the first year post-diagnosis.', members: [] },
  { id: 'c3', name: 'Pain Management & Mobility', description: 'Strategies for chronic pain and limited mobility.', members: [] },
  { id: 'c4', name: 'Pediatric Surgery Prep', description: 'Getting ready for major interventions.', members: [] },
  { id: 'c5', name: 'Neurological Symptoms', description: 'Coping with seizures, neuropathy, and migraines.', members: [] },
  { id: 'c6', name: 'Rare Adult Diagnostics', description: 'Adults seeking rare disease diagnoses.', members: [] }
];

export default function CommunityPage() {
  const { user, profile } = useAuth();
  
  const [activeCircle, setActiveCircle] = useState<string | null>(null);
  
  const [allCircles, setAllCircles] = useState<Circle[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingCircles, setLoadingCircles] = useState(true);

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<PostType>('Experience');
  
  // Smart features state
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Modals and Interactions
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [expandedReplies, setExpandedReplies] = useState<string[]>([]);
  
  // My Subscribed Circles
  const joinedCircleIds = profile?.joinedCircles || [];
  const myCircles = allCircles.filter(circle => joinedCircleIds.includes(circle.id));

  // Initialize and Subscribe to Circles
  useEffect(() => {
    const circlesRef = collection(db, 'circles');

    const initCircles = async () => {
      // Check if c1 exists. If not, seed the DB.
      const snap = await getDoc(doc(db, 'circles', 'c1'));
      if (!snap.exists()) {
        for (const circle of initializeCirclesData) {
          await setDoc(doc(db, 'circles', circle.id), circle);
        }
      }
    };
    initCircles();

    // Listen to real-time changes so member counts update automatically
    const unsubscribe = onSnapshot(circlesRef, (snapshot) => {
      const fetchedCircles: Circle[] = [];
      snapshot.forEach(doc => {
        fetchedCircles.push({ id: doc.id, ...doc.data() } as Circle);
      });
      setAllCircles(fetchedCircles);
      setLoadingCircles(false);
      
      // Select first joined circle automatically if activeCircle is null and user has joined circles
      if (!activeCircle && user) {
        // We can't automatically assume myCircles array is fresh enough inside this scope,
        // but we rely on a separate useEffect for that.
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle default active circle selection when myCircles changes
  useEffect(() => {
    if (myCircles.length > 0 && !activeCircle) {
      setActiveCircle(myCircles[0].id);
    }
  }, [myCircles, activeCircle]);

  // Fetch Posts from Firestore IN REAL-TIME
  useEffect(() => {
    if (!activeCircle) {
      setPosts([]);
      return;
    }

    setLoadingPosts(true);
    const postsRef = collection(db, 'circles', activeCircle, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: Post[] = [];
      snapshot.forEach((doc) => {
        fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(fetchedPosts);
      setLoadingPosts(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoadingPosts(false);
    });

    return () => unsubscribe();
  }, [activeCircle]);


  // Smart Detection Logic (Mock)
  useEffect(() => {
    const text = newPostContent.toLowerCase();
    
    if (text.includes('bleeding won\'t stop') || text.includes('emergency') || text.includes('can\'t breathe')) {
      setShowCrisisAlert(true);
    } else {
      setShowCrisisAlert(false);
    }

    if (text.includes('temperature changes') || text.includes('compression garment')) {
      setIsDuplicate(true);
    } else {
      setIsDuplicate(false);
    }
  }, [newPostContent]);

  // Submit new post to Firestore
  const handlePostSubmit = async () => {
    if (!newPostContent.trim() || showCrisisAlert || !user || !activeCircle) return;

    try {
      const postsRef = collection(db, 'circles', activeCircle, 'posts');
      await addDoc(postsRef, {
        authorName: profile?.displayName || 'Anonymous User',
        authorUid: user.uid,
        context: { role: profile?.role || 'User', condition: 'Self-Reported', experience: 'Active' },
        content: newPostContent,
        type: newPostType,
        tags: ['Peer advice'],
        likes: [],
        replies: [],
        timestamp: 'Just now',
        createdAt: serverTimestamp()
      });

      setNewPostContent('');
      setIsDuplicate(false);
    } catch (err) {
      console.error("Failed to create post", err);
    }
  };

  // Like / Unlike a post
  const handleLikeToggle = async (post: Post) => {
    if (!user || !activeCircle) return alert("You must be logged in to like posts.");

    const postRef = doc(db, 'circles', activeCircle, 'posts', post.id);
    const hasLiked = post.likes.includes(user.uid);

    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });
      }
    } catch (err) {
      console.error("Failed to toggle like", err);
    }
  };

  // Reply to a post
  const handleReplySubmit = async (postId: string) => {
    const content = replyText[postId];
    if (!content || !content.trim() || !user || !activeCircle) return;

    try {
      const postRef = doc(db, 'circles', activeCircle, 'posts', postId);
      
      const newReply = {
        id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        content,
        authorName: profile?.displayName || 'Anonymous',
        authorUid: user.uid,
        timestamp: 'Just now',
        createdAt: Date.now() 
      };

      await updateDoc(postRef, {
        replies: arrayUnion(newReply)
      });
      
      setReplyText(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error("Failed to add reply", err);
    }
  };

  // Delete a reply
  const handleDeleteReply = async (postId: string, replyObject: Reply) => {
    if (!user || replyObject.authorUid !== user.uid || !activeCircle) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const postRef = doc(db, 'circles', activeCircle, 'posts', postId);
      await updateDoc(postRef, {
        replies: arrayRemove(replyObject) 
      });
    } catch (err) {
      console.error("Failed to delete reply", err);
    }
  };

  const toggleReplies = (postId: string) => {
    if (expandedReplies.includes(postId)) {
      setExpandedReplies(expandedReplies.filter(id => id !== postId));
    } else {
      setExpandedReplies([...expandedReplies, postId]);
    }
  };

  const handleJoinCircle = async (circleId: string) => {
    if (!user) {
      alert("Please log in to join circles.");
      return;
    }

    try {
      // 1. Add circle ID to user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        joinedCircles: arrayUnion(circleId)
      });

      // 2. Add user ID to circle's members list
      const circleRef = doc(db, 'circles', circleId);
      await updateDoc(circleRef, {
        members: arrayUnion(user.uid)
      });
      
      // Auto switch to it
      setActiveCircle(circleId);
      setIsExploreModalOpen(false);

    } catch (err) {
      console.error("Error joining circle:", err);
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'Experience': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Question': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Resource': return 'bg-green-100 text-green-800 border-green-200';
      case 'Emergency Insight': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loadingCircles) return <div className="text-center py-20">Loading communities...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      
      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-dark-slate mb-2">Community Intelligence</h1>
          <p className="text-light-slate">Connect with families navigating similar clinical markers and life stages.</p>
        </div>
        {!user && (
          <div className="text-sm bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-medium">
            Read-only mode. Sign in to post and interact.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LEFT SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-light-slate uppercase tracking-wider mb-4 flex items-center">
              <Users className="w-4 h-4 mr-2" /> My Circles
            </h2>
            <div className="space-y-3">
              {myCircles.length === 0 ? (
                <div className="text-xs text-light-slate p-3 bg-surface-50 rounded-xl italic">
                  You haven't joined any circles yet.
                </div>
              ) : (
                myCircles.map(circle => (
                  <button
                    key={circle.id}
                    onClick={() => setActiveCircle(circle.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                      activeCircle === circle.id 
                        ? 'bg-primary-blue text-white shadow-lg shadow-blue-500/30' 
                        : 'hover:bg-surface-50 text-dark-slate'
                    }`}
                  >
                    <p className={`font-semibold text-sm ${activeCircle === circle.id ? 'text-white' : 'text-dark-slate'}`}>
                      {circle.name}
                    </p>
                    <p className={`text-xs mt-1 ${activeCircle === circle.id ? 'text-blue-100' : 'text-light-slate'}`}>
                      {circle.members?.length || 0} members
                    </p>
                  </button>
                ))
              )}
            </div>
            <button 
                onClick={() => setIsExploreModalOpen(true)}
                className="w-full mt-4 py-2 text-sm text-primary-blue font-semibold hover:bg-surface-50 rounded-xl transition-colors flex items-center justify-center">
              <Search className="w-4 h-4 mr-2"/> Explore More
            </button>
          </div>
        </div>

        {/* MAIN FEED Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Create Post Widget */}
          <div className={`glass p-5 rounded-2xl relative overflow-hidden transition ${!user || !activeCircle ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="font-bold text-dark-slate mb-3 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-primary-blue"/> Share with this Circle
            </h3>
            
            <textarea
              className="w-full border border-surface-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-blue focus:border-transparent outline-none resize-none text-sm"
              rows={3}
              placeholder={user ? (activeCircle ? "Share an experience, ask a question, or provide an insight..." : "Select a circle to post...") : "Please log in to post..."}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              disabled={!user || !activeCircle}
            />

            {/* Smart Feature: Duplicate Detection */}
            <AnimatePresence>
                {isDuplicate && !showCrisisAlert && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-xl text-sm flex items-start"
                >
                    <HelpCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                        <span className="font-semibold block">This might have been answered before.</span>
                        Review similar past discussions before posting to get immediate answers.
                        <button className="text-yellow-600 underline ml-2 font-medium">View Similar Posts</button>
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

            {/* Smart Feature: Crisis Alert */}
            <AnimatePresence>
                {showCrisisAlert && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mt-3 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm flex items-start shadow-sm"
                >
                    <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 text-red-600 flex-shrink-0" />
                    <div>
                        <span className="font-bold text-red-700 block mb-1">Potential Medical Emergency Detected</span>
                        We noticed keywords like "bleeding won't stop". The community cannot provide emergency medical advice.
                        <div className="mt-3 flex space-x-3">
                            <button className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-red-700 transition">
                                Contact Care Team
                            </button>
                            <button className="underline text-red-600 font-medium">
                                Emergency Protocols
                            </button>
                        </div>
                    </div>
                </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-4 pb-1">
              <div className="flex space-x-2">
                {(['Experience', 'Question', 'Resource'] as PostType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setNewPostType(type)}
                    disabled={!user || !activeCircle}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      newPostType === type 
                        ? 'bg-dark-slate text-white border-dark-slate' 
                        : 'bg-surface-50 text-light-slate border-surface-200 hover:bg-surface-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button 
                onClick={handlePostSubmit}
                disabled={!newPostContent.trim() || showCrisisAlert || !user || !activeCircle}
                className="bg-primary-blue text-white px-4 py-1.5 rounded-xl text-sm font-bold flex items-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post <Send className="w-3 h-3 ml-2"/>
              </button>
            </div>
          </div>

          {/* Feed */}
          <div className="space-y-4">
            {!activeCircle ? (
              <div className="text-center py-10 text-light-slate glass rounded-2xl">
                 Join a circle from "Explore More" to view and share discussions!
              </div>
            ) : loadingPosts ? (
                <div className="text-center py-10 text-light-slate">Loading discussions...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-10 text-light-slate glass rounded-2xl">
                 No discussions here yet. Be the first to share!
              </div>
            ) : (
                posts.map(post => {
                  const hasLiked = user && post.likes?.includes(user.uid);

                  return (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={post.id} 
                        className={`p-5 rounded-2xl border ${post.isVerified ? 'bg-blue-50/30 border-blue-100 shadow-sm' : 'glass border-white/50'}`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col">
                                <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-bold text-dark-slate">{post.authorName}</span>
                                    {post.isVerified && <ShieldCheck className="w-4 h-4 text-pacific-blue" />}
                                    {post.authorUid === user?.uid && (
                                      <span className="text-[10px] bg-surface-200 text-light-slate px-2 py-0.5 rounded ml-2">You</span>
                                    )}
                                </div>
                                
                                {/* Context Badge */}
                                {post.context && (
                                  <div className="flex items-center text-xs text-light-slate bg-surface-100 px-2 py-1 rounded-md w-fit">
                                      <span>{post.context.role}</span>
                                      <span className="mx-1">•</span>
                                      <span>{post.context.condition}</span>
                                      <span className="mx-1">•</span>
                                      <span>{post.context.experience}</span>
                                  </div>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${getBadgeColor(post.type)}`}>
                                {post.type}
                            </span>
                        </div>

                        <p className="text-sm text-dark-slate leading-relaxed mb-4 whitespace-pre-wrap">
                            {post.content}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {post.tags?.map(tag => (
                                <span key={tag} className={`text-xs px-2 py-0.5 rounded-md flex items-center ${tag === 'Medically verified' ? 'bg-green-100 text-green-800' : 'bg-surface-200 text-light-slate'}`}>
                                    {tag === 'Medically verified' && <ShieldCheck className="w-3 h-3 mr-1" />}
                                    {tag === 'Warning' && <AlertCircle className="w-3 h-3 mr-1 text-red-600" />}
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Interactions */}
                        <div className="flex flex-col space-y-3">
                            <div className="flex items-center justify-between text-xs text-light-slate border-t border-surface-200 pt-3">
                                <div className="flex space-x-4">
                                    <button 
                                      onClick={() => handleLikeToggle(post)} 
                                      className={`flex items-center transition-colors font-semibold ${hasLiked ? 'text-red-500' : 'hover:text-primary-blue'}`}
                                    >
                                      <Heart className={`w-4 h-4 mr-1.5 ${hasLiked ? 'fill-red-500' : ''}`} /> 
                                      {post.likes?.length || 0}
                                    </button>
                                    <button onClick={() => toggleReplies(post.id)} className="flex items-center hover:text-primary-blue transition-colors font-semibold">
                                      <MessageSquare className="w-4 h-4 mr-1.5" /> {post.replies?.length || 0} Replies
                                    </button>
                                </div>
                                <span>{post.timestamp}</span>
                            </div>

                            {/* Replies Section */}
                            <AnimatePresence>
                                {expandedReplies.includes(post.id) && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pl-4 border-l-2 border-surface-200 space-y-3 mt-2">
                                            {post.replies?.map(reply => (
                                                <div key={reply.id} className="relative bg-surface-50 p-3 rounded-xl group hover:bg-surface-100 transition">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-xs text-dark-slate">
                                                          {reply.authorName}
                                                          {reply.authorUid === user?.uid && <span className="font-normal text-light-slate ml-1">(You)</span>}
                                                        </span>
                                                        <span className="text-[10px] text-light-slate">{reply.timestamp}</span>
                                                    </div>
                                                    <p className="text-sm text-dark-slate pr-6">{reply.content}</p>

                                                    {/* Delete Comment Button (Only for Author) */}
                                                    {user && reply.authorUid === user.uid && (
                                                      <button 
                                                        onClick={() => handleDeleteReply(post.id, reply)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        title="Delete your comment"
                                                      >
                                                        <Trash2 className="w-4 h-4" />
                                                      </button>
                                                    )}
                                                </div>
                                            ))}

                                            {/* Reply Input */}
                                            {user ? (
                                              <div className="flex items-center space-x-2 mt-2">
                                                  <input 
                                                      type="text" 
                                                      value={replyText[post.id] || ''}
                                                      onChange={(e) => setReplyText({ ...replyText, [post.id]: e.target.value })}
                                                      placeholder="Write a reply..."
                                                      className="flex-1 text-sm bg-white border border-surface-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                                                  />
                                                  <button 
                                                      onClick={() => handleReplySubmit(post.id)}
                                                      disabled={!replyText[post.id]?.trim()}
                                                      className="bg-primary-blue text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                                                  >
                                                      Reply
                                                  </button>
                                              </div>
                                            ) : (
                                              <div className="text-xs text-light-slate italic mt-2">Sign in to reply.</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                  )
                })
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR: Highlights & Guidelines */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass p-5 rounded-2xl">
            <h3 className="text-sm font-bold border-b border-surface-200 pb-2 mb-3 text-dark-slate">Important Notice</h3>
            <p className="text-xs text-light-slate mb-3 leading-relaxed">
              This structured network helps connect similar experiences. <strong className="text-dark-slate">Always consult a professional</strong> before changing care routines based on peer advice.
            </p>
            <div className="bg-red-50 text-red-800 rounded-lg p-3 text-xs flex items-start">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>In severe distress, contact your lead physician or emergency services immediately.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explore More Modal */}
      <AnimatePresence>
        {isExploreModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsExploreModalOpen(false)}></div>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-dark-slate">Explore Communities</h2>
                            <p className="text-sm text-light-slate mt-1">Discover structured circles based on clinical markers.</p>
                        </div>
                        <button onClick={() => setIsExploreModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-full transition text-light-slate">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allCircles.map(circle => {
                            const isJoined = joinedCircleIds.includes(circle.id);
                            return (
                                <div key={circle.id} className="border border-surface-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-200 transition">
                                    <div>
                                        <h3 className="font-bold text-dark-slate text-sm mb-1">{circle.name}</h3>
                                        <p className="text-xs text-light-slate mb-3">{circle.description}</p>
                                        <span className="text-xs font-semibold text-primary-blue bg-blue-50 px-2 py-1 rounded-md">{circle.members?.length || 0} members</span>
                                    </div>
                                    <button 
                                        onClick={() => handleJoinCircle(circle.id)}
                                        disabled={isJoined || !user}
                                        className={`mt-4 w-full py-1.5 rounded-lg text-sm font-bold transition ${isJoined ? 'bg-surface-100 text-light-slate cursor-default' : (!user ? 'opacity-50 cursor-not-allowed' : 'bg-dark-slate text-white hover:bg-black')}`}
                                    >
                                        {isJoined ? 'Joined' : 'Join Circle'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
