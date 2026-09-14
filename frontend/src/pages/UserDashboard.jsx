import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function UserDashboard() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const navigate = useNavigate();

  const itemsPerPage = 10;

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/login');
    } else {
      const parsed = JSON.parse(storedUser);
      if (parsed.designation !== 'USER') {
        navigate('/login');
      }
    }
  }, [navigate]);

  // Fetch real-time in-progress tokens
  const fetchInProgressTokens = async () => {
    try {
      const res = await axios.get('/api/tokens/in-progress');
      setTokens(res.data);
      setError('');
    } catch (err) {
      console.error('Error fetching live queue status:', err);
      setError('Connection to live server lost. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and every 5 seconds for real-time updates
  useEffect(() => {
    fetchInProgressTokens();
    const pollInterval = setInterval(() => {
      fetchInProgressTokens();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Cycle pages every 10 seconds
  useEffect(() => {
    const pageInterval = setInterval(() => {
      setTokens((currentTokens) => {
        if (currentTokens.length <= itemsPerPage) {
          setCurrentPage(0);
          return currentTokens;
        }
        const totalPages = Math.ceil(currentTokens.length / itemsPerPage);
        setCurrentPage((prevPage) => (prevPage + 1) % totalPages);
        return currentTokens;
      });
    }, 10000);

    return () => clearInterval(pageInterval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Calculate tokens to display on the current page
  const totalPages = Math.ceil(tokens.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const displayedTokens = tokens.slice(startIndex, startIndex + itemsPerPage);

  const getDeptBadgeStyle = (dept) => {
    const normalized = (dept || '').toUpperCase();
    if (normalized === 'PENSION') {
      return 'bg-blue-50 text-blue-700 border-blue-100';
    }
    if (normalized === 'ACCOUNTS') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
    return 'bg-purple-50 text-purple-700 border-purple-100';
  };

  return (
    <div className="flex-grow flex flex-col w-full max-w-7xl mx-auto py-8 px-4 md:px-8 space-y-6 relative z-10 font-sans">
      
      {/* Live Monitor Header banner */}
      <div className="bg-gradient-to-r from-govBlue to-blue-900 rounded-2xl border border-blue-800 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        
        <div className="relative z-10 text-center md:text-left space-y-2">
          <div className="flex items-center justify-center md:justify-start space-x-2">
            <span className="flex h-3.5 w-3.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
            </span>
            <span className="text-red-400 font-extrabold text-[11px] tracking-widest uppercase">LIVE SAMADHAN STATUS BOARD</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-serif tracking-wide">
            In-Progress Token Monitor
          </h2>
          <p className="text-blue-100 text-xs md:text-sm font-semibold max-w-xl">
            Real-time status of service tokens currently processing across Pension, Accounts, and GPF tables.
          </p>
        </div>

        <div className="relative z-10 mt-6 md:mt-0 flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-center sm:text-left">
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Active Tokens</p>
            <p className="text-2xl font-black text-white font-mono leading-none mt-1">{tokens.length}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 text-red-100 font-bold py-2.5 px-5 rounded-lg tracking-wider uppercase text-xs shadow transition duration-200"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2 font-bold animate-pulse">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Queue status display grid */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-md overflow-hidden relative glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-150 text-govBlue font-black uppercase tracking-wider text-[11px] md:text-xs">
                <th className="py-4.5 px-6 w-[150px]">Token Number</th>
                <th className="py-4.5 px-6 w-[150px]">Department</th>
                <th className="py-4.5 px-6 w-[150px]">Table No.</th>
                <th className="py-4.5 px-6 w-[150px]">PSA/DDO Code</th>
                <th className="py-4.5 px-6">PSA/DDO Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-800">
              {displayedTokens.map((tk, idx) => (
                <tr 
                  key={tk.token_number + '-' + tk.department} 
                  className="hover:bg-slate-50/50 transition-colors duration-200"
                >
                  <td className="py-4 px-6 font-mono font-extrabold text-govBlue text-sm tracking-wide">
                    <span className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{tk.token_number}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {(tk.department || '').split(', ').map((dept, dIdx) => (
                        <span key={dIdx} className={`inline-block py-1 px-2.5 rounded-full text-[10px] tracking-wide uppercase border font-extrabold ${getDeptBadgeStyle(dept)}`}>
                          {dept}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {(tk.table_no || '').split(', ').map((tNo, tIdx) => {
                        const isNotAssigned = tNo === 'Not Assigned';
                        return (
                          <span key={tIdx} className={`inline-block py-1 px-2.5 rounded-lg text-[10px] md:text-xs font-black font-mono border ${
                            isNotAssigned 
                              ? 'bg-red-50 text-red-600 border-red-100' 
                              : 'bg-govGold/10 text-govGold-dark border-govGold/20'
                          }`}>
                            {tNo}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-gray-500 font-bold">{tk.psa_code || '-'}</td>
                  <td className="py-4 px-6 text-gray-700 whitespace-normal break-words max-w-md">{tk.psa_name}</td>
                </tr>
              ))}
              
              {loading && tokens.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-govBlue border-t-transparent"></div>
                      <p className="text-gray-400 font-extrabold uppercase tracking-wider text-xs">Initializing Live Queue Monitor...</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && tokens.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-black uppercase tracking-wider text-sm">All Tokens Completed!</p>
                      <p className="text-gray-400 text-xs max-w-sm mx-auto">There are currently no active "In-Progress" tokens requiring table processing.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination/Paging Indicator loops */}
        {totalPages > 1 && (
          <div className="py-4 px-6 bg-slate-50 border-t border-gray-150 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
              Showing page {currentPage + 1} of {totalPages}
            </span>
            <div className="flex items-center space-x-1.5">
              {Array.from({ length: totalPages }).map((_, pageIdx) => (
                <button
                  key={pageIdx}
                  onClick={() => setCurrentPage(pageIdx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    pageIdx === currentPage ? 'w-8 bg-govBlue' : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-govGold font-black uppercase tracking-widest animate-pulse">
              Cycling in 10s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
