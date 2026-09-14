import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function BoDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalTokens: 18,
    inProgress: 6,
    resolved: 9,
    totalFeedback: 24,
    recentFeedback: []
  });

  // Allocation form state
  const [activeTokens, setActiveTokens] = useState([]);
  const [assignedTokens, setAssignedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Modal for viewing all entries of a clicked token
  const [activeModalToken, setActiveModalToken] = useState(null);
  const [modalEntries, setModalEntries] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Handle opening modal for a clicked token to view all its entries
  const handleTokenClick = async (tokenNum) => {
    setActiveModalToken(tokenNum);
    setModalLoading(true);
    try {
      const res = await axios.get(`/api/tokens/${tokenNum}/all-entries`);
      setModalEntries(res.data);
    } catch (err) {
      console.error('Error fetching entries for token:', err);
      const local = assignedTokens.filter(t => t.token_number === tokenNum);
      setModalEntries(local);
    } finally {
      setModalLoading(false);
    }
  };

  const extractTokenNum = (val) => {
    if (!val) return 0;
    const match = String(val).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Group assigned tokens by token_number so multiple clubbed entries are grouped into one token row in descending order
  const getGroupedAssignedTokens = () => {
    const map = new Map();
    for (const t of assignedTokens) {
      if (!map.has(t.token_number)) {
        map.set(t.token_number, {
          token_number: t.token_number,
          psa_name: t.psa_name,
          psa_code: t.psa_code,
          table_no: t.table_no,
          allocated_at: t.allocated_at,
          submitted_on: t.submitted_on,
          aao_name: t.aao_name,
          remarks: t.remarks,
          status: t.status,
          entries: []
        });
      }
      const group = map.get(t.token_number);
      group.entries.push(t);
      if (!group.table_no && t.table_no) group.table_no = t.table_no;
      if (!group.aao_name && t.aao_name) group.aao_name = t.aao_name;
      if (!group.remarks && t.remarks) group.remarks = t.remarks;
      if (!group.allocated_at && t.allocated_at) group.allocated_at = t.allocated_at;
    }
    const list = Array.from(map.values());
    // Strictly sort in descending order by token number (matching registration page)
    return list.sort((a, b) => {
      const numA = extractTokenNum(a.token_number);
      const numB = extractTokenNum(b.token_number);
      if (numB !== numA) return numB - numA;
      return (b.token_number || '').localeCompare(a.token_number || '');
    });
  };

  const [viewAllActive, setViewAllActive] = useState(false);
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAllFeedbacks = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;
        const groupName = currentUser ? currentUser.group_name : null;

        const res = await axios.get('/api/feedback/list', {
          params: { group_name: groupName }
        });
        setAllFeedbacks(res.data);
      } catch (err) {
        console.error('Error fetching all feedbacks:', err);
        setAllFeedbacks(stats.recentFeedback);
      }
    };
    if (viewAllActive) {
      fetchAllFeedbacks();
    }
  }, [viewAllActive, stats.recentFeedback]);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch metrics and active list
  const fetchData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const groupName = currentUser ? currentUser.group_name : null;

      const statsRes = await axios.get('/api/feedback/stats', {
        params: { group_name: groupName }
      });
      setStats(statsRes.data);

      const activeRes = await axios.get('/api/tokens/active-list', {
        params: { group_name: groupName }
      });
      setActiveTokens(activeRes.data);

      const assignedRes = await axios.get('/api/tokens/assigned-list', {
        params: { group_name: groupName }
      });
      setAssignedTokens(assignedRes.data);
    } catch (err) {
      console.error('Error fetching stats and active tokens:', err);
      setStats({
        totalTokens: 0,
        inProgress: 0,
        resolved: 0,
        totalFeedback: 0,
        recentFeedback: []
      });
      setActiveTokens([]);
      setAssignedTokens([]);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAllocate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedToken || !selectedTable) {
      setError('Please select both a Token Number and a Table Number.');
      return;
    }

    const [tokenNo, category] = selectedToken.split('|');
    setLoading(true);

    try {
      await axios.post('/api/tokens/allocate', {
        token_number: tokenNo,
        category: category,
        allocated_table: selectedTable,
        remarks: '',
        bo_name: user?.full_name || 'System BO'
      });

      setSuccess(`Token ${selectedToken} successfully allocated to ${selectedTable}.`);
      setSelectedToken('');
      setSelectedTable('');
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Allocation failed. Server error.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Progress':
        return 'bg-amber-50 border border-amber-200 text-amber-600 font-bold';
      case 'Resolved':
        return 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold';
      case 'Closed':
        return 'bg-purple-50 border border-purple-200 text-purple-600 font-bold';
      default:
        return 'bg-gray-50 border border-gray-200 text-gray-700 font-bold';
    }
  };

  if (viewAllActive) {
    const filteredFeedbacks = allFeedbacks.filter(fb => {
      if (!fb.submitted_on) return true;
      const fbDate = new Date(fb.submitted_on).toISOString().split('T')[0];
      if (startDate && fbDate < startDate) return false;
      if (endDate && fbDate > endDate) return false;
      return true;
    });

    const downloadCSV = () => {
      const headers = ['Token Number', 'Category', 'Submitted On', 'Feedback', 'Remarks', 'Status'];
      const csvRows = filteredFeedbacks.map(fb => [
        fb.token_number,
        fb.category,
        new Date(fb.submitted_on).toLocaleString(),
        fb.feedback ? fb.feedback.replace(/"/g, '""') : '',
        fb.remarks ? fb.remarks.replace(/"/g, '""') : '',
        fb.status
      ]);
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(val => `"${val}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `samadhan_feedbacks_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const handlePrint = () => {
      window.print();
    };

    return (
      <div className="flex-grow flex flex-col w-full max-w-[96%] xl:max-w-[95%] 2xl:max-w-[1700px] mx-auto py-8 px-2 sm:px-4 md:px-6 space-y-6 relative z-10 font-sans">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #print-section, #print-section * {
              visibility: visible;
            }
            #print-section {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Back navigation and title row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4 no-print">
          <div>
            <button
              onClick={() => setViewAllActive(false)}
              className="text-govBlue hover:text-govBlue-dark font-extrabold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition mb-1.5 focus:outline-none cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
            <h2 className="text-2xl font-extrabold text-govBlue font-serif">All Received Feedbacks</h2>
          </div>
          
          {/* Print/Download Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="bg-white hover:bg-slate-50 text-govBlue font-bold py-2.5 px-4 rounded-lg text-xs md:text-sm tracking-wider uppercase border border-gray-300 shadow-sm transition flex items-center space-x-2 cursor-pointer focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print / PDF</span>
            </button>
            <button
              onClick={downloadCSV}
              className="bg-govBlue hover:bg-govBlue-dark text-white font-bold py-2.5 px-4 rounded-lg text-xs md:text-sm tracking-wider uppercase shadow-sm transition flex items-center space-x-2 cursor-pointer focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Date Filter Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm no-print">
          <h4 className="text-govBlue font-bold text-xs uppercase tracking-wider mb-4 flex items-center">
            <svg className="w-4 h-4 mr-1.5 text-govGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Feedbacks by Date Range
          </h4>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-2.5 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full py-2.5 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="py-2.5 px-4 rounded-lg border border-gray-300 hover:bg-slate-50 text-xs md:text-sm font-bold uppercase text-gray-700 tracking-wider transition cursor-pointer focus:outline-none"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Print Section (Table of Feedbacks) */}
        <div id="print-section" className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="hidden print:block text-center py-6 border-b border-gray-200">
            <h2 className="text-2xl font-extrabold text-govBlue font-serif">SAMADHAN PORTAL</h2>
            <p className="text-xs uppercase font-extrabold tracking-widest text-govGold mt-1">Grievance & Support Feedbacks Report</p>
            {startDate || endDate ? (
              <p className="text-xs text-gray-500 mt-2 font-bold">
                Filtered Range: {startDate || 'Beginning'} to {endDate || 'Today'}
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] md:text-xs font-extrabold text-govBlue uppercase tracking-widest">
                  <th className="py-4 px-6">Token Number</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Submitted On</th>
                  <th className="py-4 px-6">Feedback</th>
                  <th className="py-4 px-6">AAO Remarks</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-805">
                {filteredFeedbacks.map((fb, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6 font-extrabold text-govBlue tracking-wide">{fb.token_number}</td>
                    <td className="py-4 px-6">{fb.category}</td>
                    <td className="py-4 px-6 text-gray-500">{formatDateTime(fb.submitted_on)}</td>
                    <td className="py-4 px-6 text-gray-700 whitespace-pre-wrap">{fb.feedback}</td>
                    <td className="py-4 px-6 text-gray-600 italic font-semibold">{fb.remarks || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block py-1 px-3.5 rounded-full text-[10px] tracking-wide uppercase ${getStatusStyle(fb.status)}`}>
                        {fb.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredFeedbacks.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider">
                      No feedback entries match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col w-full max-w-[96%] xl:max-w-[95%] 2xl:max-w-[1700px] mx-auto py-8 px-2 sm:px-4 md:px-6 space-y-6 relative z-10 font-sans">
      
      {/* Subheader Banner with uploaded background image */}
      <div className="relative rounded-2xl border border-blue-100 text-govBlue p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-sm overflow-hidden min-h-[160px]">
        {/* Background Image of Secretariat Building */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/agbengal.png" 
            alt="Secretariat Building" 
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle gradient overlay to ensure text contrast and legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50/95 via-blue-50/80 to-transparent" />
        </div>
        
        {/* Banner Welcome text details */}
        <div className="relative z-10 text-center md:text-left">
          <p className="text-govBlue/75 font-semibold text-xs md:text-sm tracking-wide uppercase">Welcome Back,</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-govBlue font-serif mt-1">
            {user?.rep_name || 'Rajesh Kumar'}
          </h2>
          <p className="text-gray-700 text-xs md:text-sm font-bold mt-2.5">
            We are here to serve you better.
          </p>
        </div>
      </div>

      {/* 4 Metric Cards with icons on left and text on right */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Tokens Generated */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm flex items-center space-x-5 glass-card">
          <div className="w-14 h-14 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            {/* Document icon */}
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-emerald-700 font-serif leading-none">{stats.totalTokens}</p>
            <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1.5">Total Tokens Generated</p>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm flex items-center space-x-5 glass-card">
          <div className="w-14 h-14 bg-amber-50 rounded-full text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
            {/* Hourglass icon */}
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-amber-600 font-serif leading-none">{stats.inProgress}</p>
            <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1.5">In Progress</p>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm flex items-center space-x-5 glass-card">
          <div className="w-14 h-14 bg-blue-50 rounded-full text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
            {/* Check double icon */}
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-700 font-serif leading-none">{stats.resolved}</p>
            <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1.5">Resolved</p>
          </div>
        </div>

        {/* Total Feedback */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm flex items-center space-x-5 glass-card">
          <div className="w-14 h-14 bg-purple-50 rounded-full text-purple-600 border border-purple-100 flex items-center justify-center flex-shrink-0">
            {/* Chat bubble icon */}
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-purple-700 font-serif leading-none">{stats.totalFeedback}</p>
            <p className="text-gray-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1.5">Total Feedback</p>
          </div>
        </div>
      </div>

      {/* Token Allocation Section */}
      <div className="bg-white p-8 rounded-2xl border border-gray-150 shadow-sm glass-card">
        <h3 className="text-govBlue font-bold text-xs uppercase tracking-wider border-b border-govBlue/20 pb-4 flex items-center">
          {/* Outline Document check list icon */}
          <svg className="w-5 h-5 mr-2 text-govGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Token Allocation
        </h3>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-lg flex items-center space-x-2">
            <span className="font-bold">{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
            <span className="font-bold">{success}</span>
          </div>
        )}

        <form onSubmit={handleAllocate} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end mt-6">
          <div>
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              Token Number <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full py-3 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
              required
            >
              <option value="">Select Token Number</option>
              {activeTokens.map((tk, idx) => (
                <option key={idx} value={tk.token_number + '|' + tk.category}>
                  {tk.token_number} ({tk.category}){tk.rep_names ? ` — ${tk.rep_names}` : ''}{tk.entry_count > 1 ? ` [${tk.entry_count} clubbed queries]` : ''}
                </option>
              ))}
              {activeTokens.length === 0 && (
                <option disabled value="">No active tokens available</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              PSA / DDO & Representative Details
            </label>
            <input
              type="text"
              value={(() => {
                if (!selectedToken) return '';
                const [tokenNo, category] = selectedToken.split('|');
                const found = activeTokens.find(t => t.token_number === tokenNo && t.category === category);
                if (!found) return '';
                const parts = [found.psa_name || 'N/A'];
                if (found.psa_code) parts.push(`(Code: ${found.psa_code})`);
                if (found.rep_names) parts.push(`— Rep: ${found.rep_names}`);
                return parts.join(' ');
              })()}
              readOnly
              placeholder="Auto-filled PSA & Representative"
              className="w-full py-3 px-4 rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700 cursor-not-allowed truncate"
              title={(() => {
                if (!selectedToken) return '';
                const [tokenNo, category] = selectedToken.split('|');
                const found = activeTokens.find(t => t.token_number === tokenNo && t.category === category);
                if (!found) return '';
                return `${found.psa_name || 'N/A'} (Code: ${found.psa_code || 'N/A'}) — Rep: ${found.rep_names || 'N/A'}`;
              })()}
            />
          </div>

          <div>
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              Allocate Table Number <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full py-3 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
              required
            >
              <option value="">Select Table Number</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={`Table ${num}`}>{`Table ${num}`}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-govBlue hover:bg-govBlue-dark text-white font-bold py-3.5 px-4 rounded-lg tracking-wider uppercase text-sm shadow transition duration-200 flex items-center justify-center space-x-2 h-[46px]"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Assign</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Assigned Tokens Real-time Tracking Section */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden glass-card">
        <div className="py-5 px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-govBlue font-bold text-xs uppercase tracking-wider flex items-center">
            {/* Clock/history tracking outline */}
            <svg className="w-5 h-5 mr-2 text-govGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Assigned Tokens Real-time Tracking ({getGroupedAssignedTokens().length} tokens / {assignedTokens.length} total queries)
          </h3>
          <span className="text-[11px] text-gray-500 font-medium">
            Showing 10 tokens per page (clubbed queries grouped)
          </span>
        </div>

        {(() => {
          const groupedTokens = getGroupedAssignedTokens();
          const totalPages = Math.ceil(groupedTokens.length / rowsPerPage) || 1;
          const startIndex = (currentPage - 1) * rowsPerPage;
          const paginatedTokens = groupedTokens.slice(startIndex, startIndex + rowsPerPage);

          return (
            <>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-3 whitespace-nowrap">Token Number</th>
                      <th className="py-3 px-3">PSA / DDO Office & Code</th>
                      <th className="py-3 px-3">Representative Name(s)</th>
                      <th className="py-3 px-2 text-center whitespace-nowrap">Assigned Table</th>
                      <th className="py-3 px-2.5 whitespace-nowrap">Assigned On</th>
                      <th className="py-3 px-2.5 whitespace-nowrap">AAO Operator</th>
                      <th className="py-3 px-2.5">AAO Remarks</th>
                      <th className="py-3 px-3 whitespace-nowrap">Entries Status</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-800">
                    {paginatedTokens.map((group) => (
                      <tr key={group.token_number} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap align-top">
                          <button 
                            onClick={() => handleTokenClick(group.token_number)}
                            className="text-left group focus:outline-none cursor-pointer"
                            title="Click to view all entries and individual remarks"
                          >
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-govBlue group-hover:text-blue-700 underline underline-offset-2 tracking-wide text-xs md:text-sm font-mono">
                                {group.token_number}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                group.entries.length > 1
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-blue-100 text-govBlue border-blue-200'
                              }`}>
                                {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-0.5 group-hover:text-blue-600">
                              Click to view all queries
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-3 align-top min-w-[160px] max-w-[240px]">
                          <div className="font-bold text-gray-900 text-xs leading-snug">{group.psa_name || 'N/A'}</div>
                          {group.psa_code && (
                            <span className="inline-block mt-1 font-mono text-[10px] font-bold bg-slate-100 text-govBlue px-1.5 py-0.5 rounded border border-slate-200">
                              Code: {group.psa_code}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top min-w-[170px]">
                          <div className="space-y-1.5">
                            {group.entries.map((e, idx) => (
                              <div key={e.entry_id || idx} className="text-xs">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-bold text-gray-800 flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-1 text-govBlue/60 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.75 16.65c0-2.43 1.92-4.4 4.35-4.4h7.8c2.43 0 4.35 1.97 4.35 4.4V18a1 1 0 01-1 1H4.75a1 1 0 01-1-1v-1.35z" clipRule="evenodd" />
                                    </svg>
                                    {e.rep_name || 'N/A'}
                                  </span>
                                  {e.mobile && <span className="text-gray-400 text-[11px] font-mono">({e.mobile})</span>}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {e.SERVICE_PENSION && (
                                    <span className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                      Pension
                                    </span>
                                  )}
                                  {e.SERVICE_ACCOUNTS && (
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                      Accounts
                                    </span>
                                  )}
                                  {e.SERVICE_GPF && (
                                    <span className="bg-purple-50 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-200">
                                      GPF
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center align-top whitespace-nowrap">
                          <span className="inline-block py-0.5 px-2 bg-govGold/10 text-govGold-dark border border-govGold/20 rounded-md font-bold font-mono text-xs">
                            {group.table_no || 'Not Assigned'}
                          </span>
                        </td>
                        <td className="py-3 px-2.5 text-gray-500 font-mono text-xs align-top whitespace-nowrap">
                          {formatDateTime(group.allocated_at || group.submitted_on)}
                        </td>
                        <td className="py-3 px-2.5 text-gray-700 font-bold text-xs align-top whitespace-nowrap">
                          {group.aao_name || '-'}
                        </td>
                        <td className="py-3 px-2.5 text-gray-655 italic text-xs align-top max-w-[130px] truncate" title={group.remarks || ''}>
                          {group.remarks || '-'}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            {group.entries.map((e, idx) => (
                              <div key={e.entry_id || idx} className="flex items-center gap-1.5">
                                {group.entries.length > 1 && (
                                  <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[85px]">
                                    {e.rep_name ? e.rep_name.split(' ')[0] : `#${idx + 1}`}:
                                  </span>
                                )}
                                <span className={`inline-block py-0.5 px-2.5 rounded-full text-[10px] tracking-wide uppercase ${getStatusStyle(e.status)}`}>
                                  {e.status === 'Resolved' ? 'Completed' : e.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                          <button
                            onClick={() => handleTokenClick(group.token_number)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-govBlue hover:bg-govBlue-dark text-white rounded-lg text-xs font-bold transition duration-150 shadow-sm cursor-pointer whitespace-nowrap"
                            title="View all entries and details"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Queries ({group.entries.length})
                          </button>
                        </td>
                      </tr>
                    ))}
                    {groupedTokens.length === 0 && (
                      <tr>
                        <td colSpan="9" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                          No tokens have been assigned yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {groupedTokens.length > 0 && (
                <div className="py-4 px-6 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/60">
                  <div className="text-xs text-gray-600 font-medium">
                    Showing <strong className="text-govBlue">{startIndex + 1}</strong> to{' '}
                    <strong className="text-govBlue">{Math.min(startIndex + rowsPerPage, groupedTokens.length)}</strong> of{' '}
                    <strong className="text-govBlue">{groupedTokens.length}</strong> assigned tokens ({assignedTokens.length} total clubbed queries)
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Previous Button */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-250'
                          : 'bg-white text-govBlue hover:bg-govBlue hover:text-white border border-gray-300 shadow-sm'
                      }`}
                    >
                      <span>‹ Prev</span>
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (totalPages > 7) {
                        if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                          if (page === 2 || page === totalPages - 1) {
                            return <span key={page} className="px-1.5 text-xs text-gray-400">...</span>;
                          }
                          return null;
                        }
                      }
                      const isActive = page === currentPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                            isActive
                              ? 'bg-govBlue text-white shadow font-extrabold'
                              : 'bg-white text-gray-700 hover:bg-slate-100 border border-gray-250'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    {/* Next Button */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-250'
                          : 'bg-white text-govBlue hover:bg-govBlue hover:text-white border border-gray-300 shadow-sm'
                      }`}
                    >
                      <span>Next ›</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Recent Feedback Section */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden glass-card">
        <div className="py-5 px-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-govBlue font-bold text-xs uppercase tracking-wider flex items-center">
            {/* Speech bubble outline */}
            <svg className="w-5 h-5 mr-2 text-govGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Recent Feedback
          </h3>
          <button 
            onClick={() => setViewAllActive(true)}
            className="text-govBlue hover:text-govBlue-light font-bold text-xs md:text-sm hover:underline cursor-pointer focus:outline-none"
          >
            View All
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">
                <th className="py-4 px-6">Token Number</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Submitted On</th>
                <th className="py-4 px-6">Feedback</th>
                <th className="py-4 px-6">AAO Remarks</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-800">
              {stats.recentFeedback.map((fb, idx) => (
                <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 px-6 font-extrabold text-govBlue tracking-wide">{fb.token_number}</td>
                  <td className="py-4 px-6">{fb.category}</td>
                  <td className="py-4 px-6 text-gray-500">{formatDateTime(fb.submitted_on)}</td>
                  <td className="py-4 px-6 text-gray-650 max-w-xs truncate md:max-w-md">{fb.feedback}</td>
                  <td className="py-4 px-6 text-gray-600 italic font-semibold">{fb.remarks || '-'}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-block py-1 px-3.5 rounded-full text-[10px] tracking-wide uppercase ${getStatusStyle(fb.status)}`}>
                      {fb.status}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.recentFeedback.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                    No feedbacks submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: All Entries for Clicked Token */}
      {activeModalToken && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-govBlue text-white flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-govGold" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-extrabold tracking-wide text-white font-mono">
                      Token: {activeModalToken}
                    </h3>
                    <span className="bg-govGold text-govBlue text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {modalEntries.length} {modalEntries.length === 1 ? 'Query' : 'Clubbed Queries'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-100 font-medium">
                    All representative queries clubbed under this token.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setActiveModalToken(null)}
                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition duration-150 cursor-pointer"
                title="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50/50">
              {modalLoading ? (
                <div className="py-12 text-center text-gray-500 font-semibold flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-govBlue border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs uppercase tracking-wider">Loading token entries...</p>
                </div>
              ) : modalEntries.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-semibold">
                  No entries found for this token.
                </div>
              ) : (
                modalEntries.map((entry, index) => {
                  return (
                    <div 
                      key={entry.entry_id || index}
                      className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-govBlue/40 transition-colors"
                    >
                      {/* Entry Header Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="bg-slate-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              Query #{index + 1}
                            </span>
                            <span className="font-extrabold text-govBlue text-base">
                              {entry.rep_name || 'No Name Provided'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                            {entry.psa_name && <span>🏢 <strong className="text-gray-800">{entry.psa_name}</strong></span>}
                            {entry.psa_code && (
                              <span className="font-mono font-bold bg-slate-100 text-govBlue px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                                Code: {entry.psa_code}
                              </span>
                            )}
                            {entry.mobile && <span>📱 <strong className="font-mono text-gray-700">{entry.mobile}</strong></span>}
                            {entry.email && <span>✉️ {entry.email}</span>}
                          </div>
                          
                          {/* Query Services requested */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mr-1">Services:</span>
                            {entry.SERVICE_PENSION && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                Pension: {entry.SERVICE_PENSION}
                              </span>
                            )}
                            {entry.SERVICE_ACCOUNTS && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                Accounts: {entry.SERVICE_ACCOUNTS}
                              </span>
                            )}
                            {entry.SERVICE_GPF && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                GPF: {entry.SERVICE_GPF}
                              </span>
                            )}
                            {!entry.SERVICE_PENSION && !entry.SERVICE_ACCOUNTS && !entry.SERVICE_GPF && (
                              <span className="bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded">
                                General Query
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-1">
                          <span className={`inline-block py-1 px-3 rounded-full text-xs tracking-wide uppercase ${getStatusStyle(entry.status)}`}>
                            {entry.status === 'Resolved' ? 'Completed' : (entry.status || 'Pending')}
                          </span>
                          {entry.submitted_on && (
                            <span className="text-[11px] text-gray-400">
                              {formatDateTime(entry.submitted_on)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Entry Details: Table & Remarks */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-3.5 rounded-lg border border-slate-150 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                            Assigned Table & Operator:
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-govBlue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {entry.table_no || entry.table_assigned || 'Not Assigned'}
                            </span>
                            {entry.aao_name && (
                              <span className="text-gray-700 font-medium">
                                ({entry.aao_name})
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                            AAO Remarks:
                          </span>
                          <p className="text-gray-700 italic font-medium">
                            {entry.remarks ? `"${entry.remarks}"` : <span className="text-gray-400 not-italic">No remarks entered yet</span>}
                          </p>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setActiveModalToken(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition duration-150 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* White Dashboard themed Footer */}
      <footer className="border-t border-gray-200 bg-white/90 py-4 px-6 rounded-xl shadow-inner flex flex-col sm:flex-row items-center justify-between text-xs tracking-wide text-gray-500 font-semibold">
        <div className="mb-2 sm:mb-0">
          &copy; 2024 SAMADHAN. All rights reserved.
        </div>
        <div className="flex items-center space-x-4">
          <a href="#privacy" className="hover:text-govBlue transition-colors">Privacy Policy</a>
          <span>|</span>
          <a href="#terms" className="hover:text-govBlue transition-colors">Terms of Use</a>
          <span>|</span>
          <a href="#contact" className="hover:text-govBlue transition-colors">Contact Us</a>
        </div>
      </footer>

    </div>
  );
}
