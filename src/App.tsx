import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  User, 
  Sparkles, 
  Loader2, 
  Trash2, 
  BookOpen,
  History,
  LogIn,
  LogOut,
  Coins
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { askTemanPintar } from './services/geminiService';
import { cn } from './lib/utils';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'image' | 'audio';
    url: string;
  }[];
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<{ tokens: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tutor' | 'history'>('tutor');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Initialize user data in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          const initialData = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            tokens: 10,
            createdAt: serverTimestamp()
          };
          await setDoc(userDocRef, initialData);
          setUserData({ tokens: 10 });
        } else {
          setUserData(userDoc.data() as any);
        }

        // Listen for token updates
        const unsubUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) setUserData(doc.data() as any);
        });

        // Listen for message history
        const q = query(
          collection(db, 'users', currentUser.uid, 'messages'),
          orderBy('timestamp', 'asc')
        );
        const unsubMessages = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          })) as Message[];
          setMessages(msgs);
        });

        return () => {
          unsubUser();
          unsubMessages();
        };
      } else {
        setMessages([]);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const logout = () => signOut(auth);

  const handleSend = async (text?: string, fileData?: { mimeType: string, data: string, previewUrl: string, type: 'image' | 'audio' }) => {
    if (!user) {
      login();
      return;
    }

    if (userData && userData.tokens <= 0) {
      alert("Waduh, token kamu habis! Tunggu besok atau hubungi admin ya.");
      return;
    }

    const messageText = text || input;
    if (!messageText.trim() && !fileData) return;

    setIsLoading(true);
    setInput('');

    try {
      // 1. Save user message to Firestore
      const userMsgRef = await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'user',
        userId: user.uid,
        content: messageText,
        timestamp: serverTimestamp(),
        attachments: fileData ? [{ type: fileData.type, url: fileData.previewUrl }] : null
      });

      // 2. Reduce token
      await updateDoc(doc(db, 'users', user.uid), {
        tokens: increment(-1)
      });

      // 3. Get AI Response
      const response = await askTemanPintar(fileData ? { mimeType: fileData.mimeType, data: fileData.data } : messageText);
      
      // 4. Save AI message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        role: 'ai',
        userId: user.uid,
        content: response,
        timestamp: serverTimestamp()
      });

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      handleSend("", {
        mimeType: file.type,
        data: base64Data,
        previewUrl: URL.createObjectURL(file),
        type: type
      });
    };
    reader.readAsDataURL(file);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="h-screen w-full p-4 md:p-6 overflow-hidden">
      <div className="w-full h-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-[32px] flex overflow-hidden shadow-2xl shadow-black/20">
        
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-white/20 flex flex-col p-6 hidden md:flex">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl shadow-lg">🤝</div>
            <h1 className="text-white font-bold text-xl tracking-tight italic">Balad Pinter</h1>
          </div>

          <nav className="space-y-2 flex-1">
            <div 
              onClick={() => setActiveTab('tutor')}
              className={cn(
                "glass-sidebar-item",
                activeTab === 'tutor' && "glass-sidebar-item-active"
              )}
            >
              <span className="text-lg">💬</span> Diskusi Materi
            </div>
            <div 
              onClick={() => setActiveTab('history')}
              className={cn(
                "glass-sidebar-item",
                activeTab === 'history' && "glass-sidebar-item-active"
              )}
            >
              <span className="text-lg">📚</span> Materi Kamu
            </div>
          </nav>

          <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Coins size={16} className="text-yellow-400" />
              <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Tokens: {userData?.tokens ?? 0}</p>
            </div>
            <p className="text-white text-xs font-semibold">{user ? user.displayName : 'Belum Login'}</p>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
              <div 
                className="bg-yellow-400 h-full shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all duration-500" 
                style={{ width: `${Math.min(100, ((userData?.tokens ?? 0) / 10) * 100)}%` }}
              ></div>
            </div>
          </div>

          {user ? (
            <button 
              onClick={logout}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
            >
              <LogOut size={14} /> Keluar
            </button>
          ) : (
            <button 
              onClick={login}
              className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-white text-indigo-900 transition-all shadow-lg shadow-black/20"
            >
              <LogIn size={14} /> Masuk dengan Google
            </button>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
          
          <header className="flex items-center justify-between mb-6">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg">🤝</div>
              <h1 className="text-white font-bold tracking-tight italic">Balad Pinter</h1>
            </div>
            <div className="flex-1 max-w-lg md:ml-0 md:mr-4 ml-4">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-2.5 text-white/90 flex items-center justify-between shadow-inner px-5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Status</span>
                  <span className="text-xs font-bold truncate">
                    {user ? (isLoading ? "Sedang Mengetik..." : `Siap Menemani, ${user.displayName?.split(' ')[0]}`) : "Login buat mulai!"}
                  </span>
                </div>
                <div className="flex gap-3 ml-2">
                  <span onClick={() => user && fileInputRef.current?.click()} className={cn("text-lg cursor-pointer transition-all", user ? "opacity-70 hover:opacity-100" : "opacity-20 cursor-not-allowed")}>📷</span>
                  <span onClick={() => user && audioInputRef.current?.click()} className={cn("text-lg cursor-pointer transition-all", user ? "opacity-70 hover:opacity-100" : "opacity-20 cursor-not-allowed")}>🎙️</span>
                </div>
              </div>
            </div>
            {messages.length > 0 && (
              <button 
                onClick={clearChat}
                className="p-3 text-white/60 hover:text-white transition-colors"
                title="Hapus Chat"
              >
                <Trash2 size={20} />
              </button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center px-4"
                >
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center mb-6 shadow-xl">
                    <BookOpen size={40} className="text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Halo! Aku Balad Pinter 🤝</h2>
                  <p className="text-white/70 max-w-sm mb-8 text-sm">
                    Yuk tanya PR atau belajar materi baru bareng aku. Setiap pertanyaan butuh 1 token ya! Kamu dapet 10 token awal.
                  </p>
                  {!user && (
                    <button 
                      onClick={login}
                      className="px-8 py-4 bg-white text-indigo-900 rounded-2xl font-bold text-sm shadow-2xl shadow-indigo-500/20 hover:scale-105 transition-all flex items-center gap-2"
                    >
                      <LogIn size={18} /> Masuk Sekarang
                    </button>
                  )}
                  {user && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                      {[
                        "Jelasin Hukum Newton 1 dong!",
                        "Tips belajar Biologi yang asyik?",
                        "Rangkum rumus Phytagoras!",
                        "Persiapan ujian MTK gimana ya?"
                      ].map((hint) => (
                        <button
                          key={hint}
                          onClick={() => handleSend(hint)}
                          className="text-left p-3 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold text-white"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "group relative p-5 md:p-6 shadow-lg",
                      msg.role === 'user' 
                        ? "bg-white/20 backdrop-blur-md border border-white/30 rounded-[24px] rounded-tr-none ml-12" 
                        : "bg-white/30 backdrop-blur-xl border border-white/40 rounded-[28px] rounded-tl-none mr-12"
                    )}>
                      {msg.attachments?.map((att, i) => (
                        <div key={i} className="mb-4 rounded-xl overflow-hidden border border-white/20 shadow-inner">
                          {att.type === 'image' ? (
                            <img src={att.url} alt="Uploaded" className="max-w-xs md:max-w-md" referrerPolicy="no-referrer" />
                          ) : (
                            <audio src={att.url} controls className="w-full h-10" />
                          )}
                        </div>
                      ))}
                      
                      <div className={cn("markdown-body")}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      
                      <div className={cn(
                        "text-[9px] mt-4 font-bold opacity-40 uppercase tracking-widest",
                        msg.role === 'user' ? "text-right" : "text-left"
                      )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            {isLoading && (
              <div className="flex items-center gap-3 text-white/50 animate-pulse ml-4">
                <div className="w-8 h-8 glass-card flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Lagi Mikir...</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Footer Input */}
          <div className="mt-6 flex items-center gap-4">
            <div className="bg-black/40 flex-1 rounded-2xl p-4 flex items-center border border-white/10 backdrop-blur-md group focus-within:bg-black/50 transition-all relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={user ? "Ketik pertanyaanmu di sini..." : "Login dulu yuk buat tanya..."} 
                disabled={isLoading || !user}
                className="bg-transparent border-none text-white outline-none w-full placeholder:text-white/20 text-sm font-medium"
              />
              <div className="flex items-center gap-3 ml-2">
                <button 
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim() || !user || (userData?.tokens ?? 0) <= 0}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-xl",
                    (input.trim() && user && (userData?.tokens ?? 0) > 0) ? "bg-white text-indigo-900 scale-100 rotate-0" : "bg-white/5 text-white/10 scale-90"
                  )}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Send size={18} />}
                </button>
              </div>
              {!user && (
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px] rounded-2xl flex items-center justify-center cursor-pointer" onClick={login}>
                  <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">Klik untuk Login</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Hidden Inputs */}
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'image')} accept="image/*" className="hidden" />
          <input type="file" ref={audioInputRef} onChange={(e) => handleFileUpload(e, 'audio')} accept="audio/*" className="hidden" />
        </main>
      </div>
    </div>
  );
}
