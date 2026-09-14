import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ashokaEmblem from '../assets/ashoka_emblem.png';
import cagLogo from '../assets/cag_logo.png';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Dynamic notification content based on logged in user role
      if (parsedUser.designation === 'SR. ACCOUNTS OFFICER' || parsedUser.designation?.includes('SR.')) {
        setNotifications([
          { id: 1, text: 'New tokens are waiting for table allocation.', time: 'Just now', read: false },
          { id: 2, text: 'Report: Monthly statistics were successfully compiled.', time: '1 hour ago', read: false },
          { id: 3, text: 'Welcome to Branch Officer dashboard.', time: '2 hours ago', read: false }
        ]);
      } else {
        const group = parsedUser.group_name || 'Accounts';
        setNotifications([
          { id: 1, text: `New task allocated to your table in ${group} section.`, time: 'Just now', read: false },
          { id: 2, text: 'Reminder: Complete verification of outstanding tokens.', time: '1 hour ago', read: false },
          { id: 3, text: 'Welcome to Assistant Accounts Officer dashboard.', time: '2 hours ago', read: false }
        ]);
      }
    } else {
      setUser(null);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <header className="bg-white border-b-4 border-govBlue py-4 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between shadow-md relative z-50 font-sans">
      
      {/* Left side: GOI emblem and text */}
      <div className="flex items-center space-x-4 mb-4 lg:mb-0 w-full lg:w-auto justify-between lg:justify-start">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          {/* Stylized Ashoka Lion Emblem Image */}
          <img src={ashokaEmblem} alt="Government of India Logo" className="w-12 h-14 object-contain flex-shrink-0" />
          
          <div className="flex flex-col text-[11px] font-bold text-gray-800 tracking-wider uppercase leading-none font-sans">
            <span className="text-gray-900 text-xs font-extrabold tracking-normal">Government of India</span>
            <span className="text-gray-600 text-[10px] font-semibold mt-1">भारत सरकार</span>
          </div>
        </div>
        
        {/* Vertical divider line */}
        <div className="hidden lg:block h-14 w-[1px] bg-gray-200 ml-4"></div>
      </div>

      {/* Central section: SAMADHAN title */}
      <div className="flex-1 flex flex-col items-center text-center my-3 lg:my-0">
        
        {/* Department Details (Above SAMADHAN) */}
        <div className="text-govBlue font-black text-xs md:text-sm mb-2 leading-tight flex flex-col font-sans uppercase">
          <span className="tracking-[0.06em]">भारतीय लेखा तथा लेखा-परीक्षा विभाग</span>
          <span className="tracking-[0.14em]">Indian Audit And Accounts Department</span>
          <span className="text-gray-650 font-bold text-[10px] md:text-xs mt-0.5 tracking-[0.08em]">O/o The PR.AG (A&E), West Bengal.</span>
        </div>

        {/* Title row with gold lines and gold diamond separators */}
        <div className="flex items-center space-x-4 w-full justify-center">
          <div className="hidden lg:flex items-center space-x-2 flex-1 justify-end max-w-[120px]">
            <div className="h-[1.5px] w-16 bg-govGold"></div>
            <span className="text-govGold text-[8px]">♦</span>
          </div>
          
          <h1 className="text-govBlue font-bold text-2xl md:text-3xl tracking-[0.08em] font-serif uppercase select-none">
            SAMADHAN
          </h1>
          
          <div className="hidden lg:flex items-center space-x-2 flex-1 justify-start max-w-[120px]">
            <span className="text-govGold text-[8px]">♦</span>
            <div className="h-[1.5px] w-16 bg-govGold"></div>
          </div>
        </div>
        
        {/* Slogan row with horizontal gold lines and diamond */}
        <div className="flex items-center space-x-3 mt-1.5 w-full max-w-[340px] justify-center">
          <div className="h-[1.5px] flex-1 bg-govGold/80"></div>
          <span className="text-govGold text-[9px] leading-none">♦</span>
          <span className="text-govGold text-[9px] md:text-[11px] font-bold tracking-[0.16em] uppercase font-sans whitespace-nowrap">
            Your Concern, Our Commitment
          </span>
          <span className="text-govGold text-[9px] leading-none">♦</span>
          <div className="h-[1.5px] flex-1 bg-govGold/80"></div>
        </div>
      </div>

      {/* Right section: Committed to serve or User Dropdown (conditional) */}
      <div className="flex items-center space-x-4 w-full lg:w-auto justify-end">
        {/* Vertical divider line */}
        <div className="hidden lg:block h-14 w-[1px] bg-gray-200 mr-4"></div>
        
        {user ? (
          /* User Logged-in profile section (Dashboard style) */
          <div className="flex items-center space-x-4">
            {/* Notification Bell with Custom Interactive Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                onBlur={() => setTimeout(() => setShowNotifications(false), 200)}
                className="relative p-2 text-gray-500 hover:text-govBlue hover:bg-gray-100 rounded-full transition duration-150 cursor-pointer focus:outline-none"
              >
                <svg className="w-6 h-6 text-govBlue" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center border border-white">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 text-left font-sans overflow-hidden">
                  <div className="px-4 py-3 bg-govBlue text-white flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">Notifications</span>
                    {notifications.some(n => !n.read) && (
                      <button 
                        onClick={() => {
                          setNotifications(notifications.map(n => ({ ...n, read: true })));
                        }}
                        className="text-[10px] text-govGold hover:text-white font-extrabold transition"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item));
                        }}
                        className={`p-3.5 hover:bg-slate-50 cursor-pointer transition duration-150 ${!n.read ? 'bg-slate-50/50' : ''}`}
                      >
                        <p className={`text-xs text-gray-700 leading-snug ${!n.read ? 'text-gray-900 font-extrabold' : ''}`}>{n.text}</p>
                        <span className="text-[9px] text-gray-400 mt-1 block font-bold uppercase">{n.time}</span>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-500 italic">
                        No notifications.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-8 w-[1px] bg-gray-200"></div>

            {/* User Dropdown Profile block */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-govBlue text-white flex items-center justify-center font-bold text-sm shadow-sm select-none">
                {user.rep_name ? user.rep_name.charAt(0) : 'R'}
              </div>
              <div className="text-left text-xs font-sans">
                <p className="font-bold text-gray-400 leading-none">Welcome,</p>
                <p className="font-extrabold text-govBlue mt-0.5">{user.rep_name || 'Rajesh Kumar'}</p>
              </div>
              <button 
                onClick={handleLogout}
                title="Logout" 
                className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition duration-150 cursor-pointer ml-1"
              >
                {/* Logout icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* Default "Committed to Serve" emblem (Welcome/Login/Feedback style) */
          <div className="flex items-center space-x-3">
            <div className="text-right flex flex-col font-sans uppercase leading-none text-govBlue font-bold text-[10px] md:text-xs">
              <span className="tracking-wide">Committed to Serve</span>
              <span className="text-gray-500 font-semibold text-[9px] md:text-[10px] mt-1">with Integrity</span>
            </div>
            
            <img src={cagLogo} alt="CAG Logo" className="w-14 h-14 object-contain flex-shrink-0" />
          </div>
        )}
      </div>
    </header>
  );
}
