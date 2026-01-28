import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, updateDoc, query } from 'firebase/firestore';
import { 
  LayoutDashboard, Store, FileText, Plus, X, Trash2, Crown, 
  Settings, User, Check, Search, Edit3, ChevronRight, Share2, Copy
} from 'lucide-react';

// --- Firebase Setup ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sales-monarch-ultimate-v1';

// --- Utility: Firebase Collection Helpers ---
const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocRef = (colName, id) => doc(db, 'artifacts', appId, 'public', 'data', colName, id);

export default function App() {
  const [loading, setLoading] = useState(true); 
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [brands, setBrands] = useState([]);
  const [profile, setProfile] = useState({ name: 'Sales King', region: 'Sri Lanka' });
  
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [modals, setModals] = useState({ 
    route: false, shop: false, expense: false, invoice: false, 
    brand: false, profile: false, orderDetails: false, share: false
  });
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copyStatus, setCopyStatus] = useState('Copy Link');

  // Profile Edit State
  const [editProfileData, setEditProfileData] = useState({ name: '', region: '' });

  // 1. Auth & Initial Load
  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    init();
    const unsub = onAuthStateChanged(auth, setUser);
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => { unsub(); clearTimeout(timer); };
  }, []);

  // 2. Real-time Listeners
  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(getColRef('routes'), s => setRoutes(s.docs.map(d => ({id: d.id, ...d.data()}))), (e) => console.log(e)),
      onSnapshot(getColRef('shops'), s => setShops(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(getColRef('orders'), s => setOrders(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(getColRef('expenses'), s => setExpenses(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(getColRef('brands'), s => setBrands(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(getDocRef('settings', 'profile'), d => {
        if (d.exists()) {
          setProfile(d.data());
          setEditProfileData(d.data());
        }
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [user]);

  // Filters
  const filteredShops = useMemo(() => {
    return shops.filter(s => {
      const matchRoute = !selectedRouteId || s.routeId === selectedRouteId;
      const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRoute && matchSearch;
    });
  }, [shops, selectedRouteId, searchQuery]);

  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return {
      dailySales: orders.filter(o => o.date === today).reduce((sum, o) => sum + o.total, 0),
      dailyExp: expenses.filter(e => e.date === today).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      totalOrders: orders.length
    };
  }, [orders, expenses]);

  // DB Actions
  const handleAdd = async (col, data, modal) => {
    if (!user) return;
    await addDoc(getColRef(col), { ...data, timestamp: Date.now(), date: new Date().toLocaleDateString() });
    if (modal) setModals(prev => ({ ...prev, [modal]: false }));
  };

  const handleDelete = async (col, id) => {
    if (!user) return;
    await deleteDoc(getDocRef(col, id));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    await setDoc(getDocRef('settings', 'profile'), editProfileData);
    setModals(m => ({ ...m, profile: false }));
  };

  const submitOrder = async () => {
    if (!user) return;
    const items = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const b = brands.find(x => x.id === id);
        return { name: b.name, size: b.size, price: b.price, qty, subtotal: b.price * qty };
      });
    
    if (items.length === 0) return;
    
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    await handleAdd('orders', { 
      shopId: selectedShop.id, 
      shopName: selectedShop.name, 
      items, 
      total 
    });
    setCart({});
    setModals(m => ({...m, invoice: false}));
  };

  const copyToClipboard = () => {
    const url = window.location.href;
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy Link'), 2000);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center z-[9999]">
        <div className="relative">
          <div className="absolute inset-0 bg-[#d4af37]/20 blur-[60px] animate-pulse rounded-full"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-[#d4af37] to-[#b8860b] rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.4)]">
            <Crown size={48} className="text-black animate-bounce" />
          </div>
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-3xl font-black italic tracking-tighter text-white">MONARCH</h1>
          <p className="text-[10px] text-[#d4af37] uppercase tracking-[0.3em] font-bold mt-1">Ready for Business</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans selection:bg-[#d4af37]/30">
      {/* Header */}
      <header className="p-6 flex justify-between items-center sticky top-0 bg-black/60 backdrop-blur-xl z-40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#d4af37] to-[#b8860b] rounded-xl flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
            <Crown size={22} className="text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter leading-none">MONARCH</h1>
            <p className="text-[9px] text-[#d4af37] uppercase tracking-widest font-bold">Live Production</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModals(m => ({...m, share: true}))} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 active:scale-90 transition-all">
            <Share2 size={18} />
          </button>
          <button onClick={() => setActiveTab('settings')} className="w-10 h-10 rounded-full border border-white/10 overflow-hidden active:scale-90 transition-all flex items-center justify-center bg-white/5">
            <User size={18} className="text-[#d4af37]" />
          </button>
        </div>
      </header>

      <main className="px-6 space-y-8 max-w-lg mx-auto py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5 group transition-all hover:border-[#d4af37]/20">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Today's Sales</p>
                <p className="text-2xl font-black text-[#d4af37]">Rs.{stats.dailySales}</p>
              </div>
              <div className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5 group transition-all hover:border-red-500/20">
                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Today's Exp</p>
                <p className="text-2xl font-black text-red-500">Rs.{stats.dailyExp}</p>
              </div>
            </div>

            {/* Routes Section */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Select Route</h3>
                <button onClick={() => setModals(m => ({...m, route: true}))} className="p-2 bg-[#d4af37]/10 rounded-xl text-[#d4af37] border border-[#d4af37]/20"><Plus size={18}/></button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {routes.map(r => (
                  <div key={r.id} className="flex gap-2 group">
                    <button 
                      onClick={() => setSelectedRouteId(selectedRouteId === r.id ? null : r.id)}
                      className={`flex-1 p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 ${selectedRouteId === r.id ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'bg-[#0f0f0f] border-white/5 text-white/60 hover:border-white/20'}`}
                    >
                      <span className="text-xs font-black uppercase tracking-tight">{r.name}</span>
                      {selectedRouteId === r.id ? <Check size={16}/> : <ChevronRight size={16} className="opacity-20"/>}
                    </button>
                    <button onClick={() => handleDelete('routes', r.id)} className="p-5 bg-red-500/5 rounded-2xl text-red-500/20 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </section>

            {/* Expenses List */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Recent Expenses</h3>
                <button onClick={() => setModals(m => ({...m, expense: true}))} className="p-2 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20"><Plus size={18}/></button>
              </div>
              <div className="space-y-2">
                {expenses.slice(0, 5).map(e => (
                  <div key={e.id} className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5 flex justify-between items-center group">
                    <div>
                      <p className="text-xs font-bold uppercase">{e.reason}</p>
                      <p className="text-[9px] text-white/20 font-medium">{e.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-red-500 font-black text-xs">Rs.{e.amount}</span>
                      <button onClick={() => handleDelete('expenses', e.id)} className="text-white/5 group-hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex gap-3 sticky top-24 z-30 bg-[#050505] pb-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input 
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shop name..." 
                  className="w-full bg-[#111] border border-white/5 rounded-2xl py-4 pl-12 text-xs font-bold outline-none focus:border-[#d4af37]/50"
                />
              </div>
              <button onClick={() => setModals(m => ({...m, shop: true}))} className="w-14 bg-[#d4af37] text-black rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Plus/></button>
            </div>

            <div className="space-y-3">
              {filteredShops.map(s => (
                <div key={s.id} className="bg-[#0f0f0f] p-5 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                  <div className="flex-1">
                    <h4 className="text-sm font-black uppercase text-white mb-0.5 tracking-tight">{s.name}</h4>
                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">{s.area}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setSelectedShop(s); setModals(m => ({...m, invoice: true})); }} 
                      className="bg-[#d4af37] px-6 py-3 rounded-2xl text-[10px] font-black text-black active:scale-95 transition-all shadow-lg shadow-[#d4af37]/10"
                    >
                      BILL
                    </button>
                    <button onClick={() => handleDelete('shops', s.id)} className="p-3 text-white/5 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              {filteredShops.length === 0 && (
                <div className="text-center py-20 opacity-20 italic text-xs">No shops found...</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] px-2">Order History</h3>
            {orders.sort((a,b) => b.timestamp - a.timestamp).map(o => (
              <div 
                key={o.id} 
                onClick={() => { setSelectedOrder(o); setModals(m => ({...m, orderDetails: true})); }}
                className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5 space-y-4 active:scale-98 transition-all hover:bg-[#151515]"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                      <FileText size={18}/>
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-white leading-none mb-1">{o.shopName}</h4>
                      <p className="text-[9px] text-white/30 font-bold uppercase">{o.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[#d4af37]">Rs.{o.total}</p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                       <span className="text-[8px] font-bold text-white/20 uppercase">Details</span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDelete('orders', o.id); }} 
                         className="text-red-500/20 hover:text-red-500"
                       >
                         <Trash2 size={12}/>
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] px-2">User Profile</h3>
              <button 
                onClick={() => setModals(m => ({ ...m, profile: true }))}
                className="w-full text-left bg-gradient-to-br from-[#111] to-black p-8 rounded-[3rem] border border-white/5 flex items-center gap-6 active:scale-95 transition-all group"
              >
                <div className="w-16 h-16 bg-[#d4af37] rounded-3xl flex items-center justify-center text-black group-hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all">
                  <User size={32} strokeWidth={2.5}/>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black uppercase leading-tight tracking-tight">{profile.name}</h2>
                  <p className="text-[10px] text-[#d4af37] font-bold uppercase tracking-[0.2em]">{profile.region}</p>
                </div>
                <Edit3 size={18} className="text-[#d4af37]/40" />
              </button>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center px-2">
                 <h3 className="text-[10px] font-black uppercase text-[#d4af37] tracking-[0.2em]">Product Inventory</h3>
                 <button onClick={() => setModals(m=>({...m, brand: true}))} className="p-2 bg-[#d4af37]/10 text-[#d4af37] rounded-xl"><Plus size={18}/></button>
               </div>
               <div className="grid grid-cols-1 gap-2">
                 {brands.map(b => (
                   <div key={b.id} className="bg-[#0f0f0f] border border-white/5 p-5 rounded-3xl flex justify-between items-center group transition-all hover:border-white/20">
                      <div>
                        <p className="font-black text-xs uppercase text-white">{b.name}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase mt-0.5">{b.size} • Rs.{b.price}</p>
                      </div>
                      <button onClick={() => handleDelete('brands', b.id)} className="text-white/5 group-hover:text-red-500 transition-colors p-2"><Trash2 size={16}/></button>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-8 inset-x-8 h-20 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] flex items-center justify-around z-50 shadow-2xl">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
          { id: 'shops', icon: Store, label: 'Shops' },
          { id: 'ledger', icon: FileText, label: 'Ledger' },
          { id: 'settings', icon: Settings, label: 'Setup' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === tab.id ? 'text-[#d4af37] scale-110' : 'text-white/20 hover:text-white/40'}`}
          >
            <tab.icon size={22} strokeWidth={activeTab === tab.id ? 3 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Share Modal */}
      {modals.share && (
        <div className="fixed inset-0 bg-black/90 z-[5000] flex items-center justify-center p-8 backdrop-blur-md">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-white/10 text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center text-[#d4af37] mx-auto mb-6">
                 <Share2 size={28}/>
              </div>
              <h2 className="text-white font-black uppercase text-sm mb-2">Publish App</h2>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest leading-relaxed mb-8">Share this link to access your sales terminal from any device.</p>
              
              <button 
                onClick={copyToClipboard}
                className="w-full flex items-center justify-between bg-black border border-white/10 p-5 rounded-2xl text-[10px] font-black text-[#d4af37] uppercase tracking-widest active:scale-95 transition-all mb-4"
              >
                <span>{copyStatus}</span>
                <Copy size={16}/>
              </button>

              <button onClick={() => setModals(m => ({...m, share: false}))} className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em] hover:text-white transition-colors">DISMISS</button>
           </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {modals.profile && (
        <div className="fixed inset-0 bg-black/95 z-[4000] flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-[#d4af37]/20 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-[#d4af37] font-black uppercase text-xs tracking-widest">USER SETTINGS</h2>
                <button onClick={() => setModals(m => ({...m, profile: false}))} className="text-white/20"><X size={20}/></button>
              </div>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                 <div className="space-y-2">
                   <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-1">Display Name</p>
                   <input 
                    value={editProfileData.name} 
                    onChange={e => setEditProfileData({...editProfileData, name: e.target.value})}
                    required autoFocus 
                    className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold outline-none focus:border-[#d4af37] transition-all" 
                    placeholder="Enter Name" 
                   />
                 </div>
                 <div className="space-y-2">
                   <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-1">Work Region</p>
                   <input 
                    value={editProfileData.region} 
                    onChange={e => setEditProfileData({...editProfileData, region: e.target.value})}
                    required 
                    className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold outline-none focus:border-[#d4af37] transition-all" 
                    placeholder="Enter Region" 
                   />
                 </div>
                 <button className="w-full py-5 bg-[#d4af37] text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-[#d4af37]/20 active:scale-95 transition-all">SAVE PROFILE</button>
              </form>
           </div>
        </div>
      )}

      {/* Other Modals (Route, Shop, Brand, etc. - Minimal UI) */}
      {modals.route && (
        <div className="fixed inset-0 bg-black/95 z-[5000] flex items-center justify-center p-8 backdrop-blur-sm">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-white/10">
              <h2 className="text-white font-black uppercase text-center text-[10px] mb-8 tracking-widest">NEW ROUTE</h2>
              <form onSubmit={e => { e.preventDefault(); handleAdd('routes', { name: e.target.name.value.toUpperCase() }, 'route') }}>
                 <input name="name" required autoFocus className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="E.G. COLOMBO 07" />
                 <button className="w-full py-5 bg-[#d4af37] text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">CREATE ROUTE</button>
                 <button type="button" onClick={() => setModals(m => ({...m, route: false}))} className="w-full mt-6 text-[9px] text-white/20 font-black uppercase tracking-[0.3em]">CANCEL</button>
              </form>
           </div>
        </div>
      )}

      {modals.shop && (
        <div className="fixed inset-0 bg-black/95 z-[5000] flex items-center justify-center p-8 backdrop-blur-sm">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-white/10">
              <h2 className="text-white font-black uppercase text-center text-[10px] mb-8 tracking-widest">REGISTER OUTLET</h2>
              <form onSubmit={e => { 
                e.preventDefault(); 
                handleAdd('shops', { 
                  name: e.target.name.value.toUpperCase(), 
                  area: e.target.area.value.toUpperCase(),
                  routeId: e.target.routeId.value
                }, 'shop') 
              }}>
                 <select name="routeId" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-[10px] font-black mb-4 outline-none text-[#d4af37]">
                    <option value="">SELECT ROUTE</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                 </select>
                 <input name="name" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="SHOP NAME" />
                 <input name="area" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="TOWN / AREA" />
                 <button className="w-full py-5 bg-[#d4af37] text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">REGISTER</button>
                 <button type="button" onClick={() => setModals(m => ({...m, shop: false}))} className="w-full mt-6 text-[9px] text-white/20 font-black tracking-[0.3em] uppercase">BACK</button>
              </form>
           </div>
        </div>
      )}

      {modals.brand && (
        <div className="fixed inset-0 bg-black/95 z-[5000] flex items-center justify-center p-8">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-white/10">
              <h2 className="text-white font-black uppercase text-center text-[10px] mb-8 tracking-widest">NEW PRODUCT</h2>
              <form onSubmit={async e => { 
                e.preventDefault(); 
                const data = { 
                  name: e.target.name.value.toUpperCase(), 
                  size: e.target.size.value, 
                  price: Number(e.target.price.value) 
                };
                await handleAdd('brands', data, 'brand');
              }}>
                 <input name="name" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="PRODUCT NAME" />
                 <input name="size" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="SIZE (EG. 500G)" />
                 <input name="price" type="number" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="UNIT PRICE" />
                 <button className="w-full py-5 bg-[#d4af37] text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">SAVE PRODUCT</button>
                 <button type="button" onClick={() => setModals(m => ({...m, brand: false}))} className="w-full mt-6 text-[9px] text-white/20 font-black tracking-[0.3em] uppercase">CANCEL</button>
              </form>
           </div>
        </div>
      )}

      {modals.expense && (
        <div className="fixed inset-0 bg-black/95 z-[5000] flex items-center justify-center p-8">
           <div className="bg-[#0f0f0f] w-full max-w-sm rounded-[3rem] p-10 border border-red-500/20">
              <h2 className="text-red-500 font-black uppercase text-center text-[10px] mb-8 tracking-widest">RECORD EXPENSE</h2>
              <form onSubmit={e => { 
                e.preventDefault(); 
                handleAdd('expenses', { reason: e.target.reason.value.toUpperCase(), amount: Number(e.target.amount.value) }, 'expense') 
              }}>
                 <input name="reason" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="REASON / DESCRIPTION" />
                 <input name="amount" type="number" required className="w-full bg-black border border-white/10 p-5 rounded-2xl text-xs font-bold mb-4 outline-none" placeholder="TOTAL AMOUNT" />
                 <button className="w-full py-5 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">RECORD</button>
                 <button type="button" onClick={() => setModals(m => ({...m, expense: false}))} className="w-full mt-6 text-[9px] text-white/20 font-black tracking-[0.3em] uppercase">CANCEL</button>
              </form>
           </div>
        </div>
      )}

      {modals.invoice && selectedShop && (
        <div className="fixed inset-0 bg-[#050505] z-[3000] flex flex-col p-6 animate-in slide-in-from-right duration-300">
           <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-white leading-none tracking-tight">{selectedShop.name}</h2>
                <p className="text-[10px] font-bold text-[#d4af37] uppercase tracking-[0.3em] mt-2">New Sale Transaction</p>
              </div>
              <button onClick={() => setModals(m => ({...m, invoice: false}))} className="p-4 bg-white/5 rounded-2xl active:scale-90"><X/></button>
           </div>
           
           <div className="space-y-3 pb-48 overflow-y-auto pr-2">
              {brands.map(p => (
                <div key={p.id} className="bg-[#0f0f0f] p-5 rounded-[2.5rem] flex items-center justify-between border border-white/5">
                   <div>
                      <span className="text-xs font-black block uppercase tracking-tight">{p.name}</span>
                      <span className="text-[10px] text-[#d4af37] font-black uppercase">Rs.{p.price}</span>
                   </div>
                   <div className="flex items-center gap-4 bg-black p-2 rounded-2xl border border-white/5 shadow-inner">
                      <button onClick={() => setCart({...cart, [p.id]: Math.max(0, (cart[p.id] || 0) - 1)})} className="w-10 h-10 flex items-center justify-center text-white/20 font-black text-xl">-</button>
                      <span className="font-black text-[#d4af37] w-6 text-center text-sm">{cart[p.id] || 0}</span>
                      <button onClick={() => setCart({...cart, [p.id]: (cart[p.id] || 0) + 1})} className="w-10 h-10 flex items-center justify-center text-[#d4af37] font-black text-xl">+</button>
                   </div>
                </div>
              ))}
              {brands.length === 0 && (
                <div className="text-center py-20 bg-[#0f0f0f] rounded-3xl border border-dashed border-white/10 p-10">
                   <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest">No products in inventory</p>
                   <button onClick={() => { setModals(m => ({...m, invoice: false, brand: true})); setActiveTab('settings'); }} className="mt-4 text-[9px] text-[#d4af37] font-black uppercase tracking-widest">+ Add Products First</button>
                </div>
              )}
           </div>

           <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[3.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-6 px-4">
                <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Net Total</span>
                <span className="text-3xl font-black text-[#d4af37]">Rs.{Object.entries(cart).reduce((s, [id, q]) => s + (brands.find(b => b.id === id)?.price || 0) * q, 0)}</span>
              </div>
              <button onClick={submitOrder} className="w-full py-6 bg-[#d4af37] text-black rounded-[2.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#d4af37]/20 active:scale-95 transition-all">PROCESS BILL</button>
           </div>
        </div>
      )}

      {/* Order Details Modal */}
      {modals.orderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-[#050505] z-[5000] flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
           <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
                  <FileText size={24}/>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white leading-none">{selectedOrder.shopName}</h2>
                  <p className="text-[9px] font-black text-[#d4af37] uppercase tracking-[0.2em] mt-2">Bill Ref: #{selectedOrder.id.slice(-6)}</p>
                </div>
              </div>
              <button onClick={() => setModals(m => ({...m, orderDetails: false}))} className="p-4 bg-white/5 rounded-2xl text-white/40"><X/></button>
           </div>

           <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div className="p-4 bg-white/5 rounded-3xl border border-white/5 mb-6">
                 <div className="flex justify-between items-center py-1">
                    <span className="text-[9px] text-white/20 uppercase font-black">Issue Date</span>
                    <span className="text-[10px] text-white/60 font-black uppercase">{selectedOrder.date}</span>
                 </div>
              </div>
              
              <div className="space-y-3">
                 {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-[#0f0f0f] p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                       <div>
                          <p className="text-xs font-black uppercase text-white tracking-tight">{item.name}</p>
                          <p className="text-[9px] font-bold text-white/30 uppercase mt-0.5">{item.size} • Rs.{item.price} × {item.qty}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-[#d4af37]">Rs.{item.subtotal}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="mt-8 pt-8 border-t border-white/10">
              <div className="flex justify-between items-center mb-8 px-4">
                 <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Amount Paid</span>
                 <span className="text-3xl font-black text-[#d4af37]">Rs.{selectedOrder.total}</span>
              </div>
              <button onClick={() => setModals(m => ({...m, orderDetails: false}))} className="w-full py-6 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] rounded-[2.5rem] tracking-[0.2em] active:scale-95 transition-all">BACK TO HISTORY</button>
           </div>
        </div>
      )}
    </div>
  );
}
