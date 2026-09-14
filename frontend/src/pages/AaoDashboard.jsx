import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AaoDashboard() {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState('');
  const [tokens, setTokens] = useState([]);
  const [editingRemarks, setEditingRemarks] = useState({});
  const [user, setUser] = useState(null);
  
  // Modal for viewing all entries of a clicked token
  const [activeModalToken, setActiveModalToken] = useState(null);
  const [modalEntries, setModalEntries] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/login');
    } else {
      const parsed = JSON.parse(storedUser);
      const repNameVal = parsed.rep_name || parsed.full_name || '';
      setUser({ 
        ...parsed, 
        rep_name: repNameVal.startsWith('AAO') || repNameVal.startsWith('ASSTT') 
          ? repNameVal 
          : `AAO ${repNameVal}` 
      });
    }
  }, [navigate]);

  // Fetch tokens for selected table
  const fetchTableTokens = async (tableNum) => {
    if (!tableNum) {
      setTokens([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/tokens/table/${tableNum}?group_name=${user?.group_name || ''}`);
      setTokens(res.data);
      
      // Initialize editingRemarks state keyed by entry_id
      const initialRemarks = {};
      res.data.forEach(t => {
        const key = t.entry_id || t.token_number;
        initialRemarks[key] = t.remarks || '';
      });
      setEditingRemarks(prev => ({ ...prev, ...initialRemarks }));
    } catch (err) {
      console.error('Error fetching table tokens:', err);
      setError('Failed to load tokens for the selected table. Server error.');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableTokens(selectedTable);
  }, [selectedTable]);

  // Handle opening modal for a clicked token to view all its entries
  const handleTokenClick = async (tokenNum) => {
    setActiveModalToken(tokenNum);
    setModalLoading(true);
    try {
      const res = await axios.get(`/api/tokens/${tokenNum}/all-entries`);
      setModalEntries(res.data);
      
      const newRemarks = {};
      res.data.forEach(e => {
        newRemarks[e.entry_id] = e.remarks || '';
      });
      setEditingRemarks(prev => ({ ...prev, ...newRemarks }));
    } catch (err) {
      console.error('Error fetching entries for token:', err);
      // Fallback to local entries in tokens
      const local = tokens.filter(t => t.token_number === tokenNum);
      setModalEntries(local);
    } finally {
      setModalLoading(false);
    }
  };

  // Handle status update for a specific entry
  const handleUpdateEntryStatus = async (entryId, tokenNum, newStatus, currentRemarks) => {
    setError('');
    setSuccess('');
    try {
      await axios.post('/api/tokens/update-status', {
        entry_id: entryId,
        token_number: tokenNum,
        status: newStatus,
        remarks: currentRemarks,
        group_name: user?.group_name,
        aao_name: user?.full_name || 'System AAO'
      });
      setSuccess(`Entry of Token ${tokenNum} updated to ${newStatus === 'Resolved' ? 'Completed' : newStatus}.`);
      fetchTableTokens(selectedTable);
      if (activeModalToken === tokenNum) {
        const res = await axios.get(`/api/tokens/${tokenNum}/all-entries`);
        setModalEntries(res.data);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status. Server error.');
    }
  };

  // Handle remarks save for a specific entry
  const handleSaveEntryRemarks = async (entryId, tokenNum, statusVal) => {
    const remarkVal = editingRemarks[entryId] !== undefined ? editingRemarks[entryId] : '';
    setError('');
    setSuccess('');
    try {
      await axios.post('/api/tokens/update-status', {
        entry_id: entryId,
        token_number: tokenNum,
        status: statusVal || 'In Progress',
        remarks: remarkVal,
        group_name: user?.group_name,
        aao_name: user?.full_name || 'System AAO'
      });
      setSuccess(`Remarks saved for Token ${tokenNum}.`);
      fetchTableTokens(selectedTable);
      if (activeModalToken === tokenNum) {
        const res = await axios.get(`/api/tokens/${tokenNum}/all-entries`);
        setModalEntries(res.data);
      }
    } catch (err) {
      console.error('Error saving remarks:', err);
      setError('Failed to save remarks. Server error.');
    }
  };

  // Group tokens by token_number so multiple entries are grouped
  const getGroupedTokens = () => {
    const map = new Map();
    for (const t of tokens) {
      if (!map.has(t.token_number)) {
        map.set(t.token_number, {
          token_number: t.token_number,
          psa_name: t.psa_name,
          psa_code: t.psa_code,
          allocated_table: t.allocated_table,
          submitted_on: t.submitted_on,
          entries: []
        });
      }
      map.get(t.token_number).entries.push(t);
    }
    const grouped = Array.from(map.values());
    return grouped.sort((a, b) => {
      const aActive = a.entries.some(e => e.status === 'In Progress' || e.status === 'Pending') ? 0 : 1;
      const bActive = b.entries.some(e => e.status === 'In Progress' || e.status === 'Pending') ? 0 : 1;
      return aActive - bActive;
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Progress':
        return 'bg-amber-50 border border-amber-200 text-amber-600 font-bold';
      case 'Resolved':
      case 'Completed':
        return 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold';
      case 'Closed':
        return 'bg-purple-50 border border-purple-200 text-purple-600 font-bold';
      default:
        return 'bg-gray-50 border border-gray-200 text-gray-700 font-bold';
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

  // Statistics for the selected table
  const getTableStats = () => {
    const total = tokens.length;
    const inProgress = tokens.filter(t => t.status === 'In Progress').length;
    const completed = tokens.filter(t => t.status === 'Resolved' || t.status === 'Closed' || t.status === 'Completed').length;
    const pending = tokens.filter(t => t.status === 'Pending').length;
    return { total, inProgress, completed, pending };
  };

  const stats = getTableStats();

  return (
    <div className="flex-grow flex flex-col w-full max-w-7xl mx-auto py-8 px-4 md:px-8 space-y-6 relative z-10 font-sans">
      
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
          <p className="text-govBlue/75 font-semibold text-xs md:text-sm tracking-wide uppercase">Assistant Accounts Officer (AAO)</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-govBlue font-serif mt-1">
            {user?.rep_name || 'AAO Rajesh Kumar'}
          </h2>
          <p className="text-gray-700 text-xs md:text-sm font-bold mt-2.5">
            Table-wise Service Allocation & Verification Portal
          </p>
        </div>
      </div>

      {/* Two Columns Layout Above */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Column 1: Select Table Number */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm glass-card flex flex-col justify-center">
          <h3 className="text-govBlue text-xs font-bold uppercase tracking-wider mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-govGold" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Select Table Number
          </h3>
          
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full py-3 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-bold text-gray-800"
          >
            <option value="">Select Table Number</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
              <option key={num} value={`Table ${num}`}>{`Table ${num}`}</option>
            ))}
          </select>
        </div>

        {/* Column 2: Table Stats / Info */}
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm glass-card grid grid-cols-3 gap-4 items-center">
          <div className="text-center border-r border-gray-100">
            <p className="text-2xl font-extrabold text-govBlue font-serif">{selectedTable ? stats.total : '-'}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-1">Total Assigned</p>
          </div>
          <div className="text-center border-r border-gray-100">
            <p className="text-2xl font-extrabold text-amber-600 font-serif">{selectedTable ? stats.inProgress : '-'}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-1">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-emerald-600 font-serif">{selectedTable ? stats.completed : '-'}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-1">Completed</p>
          </div>
        </div>

      </div>

      {/* Main Tabular View */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden glass-card">
        <div className="py-5 px-6 border-b border-gray-100">
          <h3 className="text-govBlue font-bold text-xs uppercase tracking-wider flex items-center">
            <svg className="w-5 h-5 mr-2 text-govGold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {selectedTable ? `Assigned Tokens - ${selectedTable}` : 'Assigned Tokens List'}
          </h3>
        </div>

        {error && (
          <div className="m-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-lg font-bold">
            {error}
          </div>
        )}
        {success && (
          <div className="m-6 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs rounded-lg font-bold">
            {success}
          </div>
        )}

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">
                <th className="py-4 px-6">Token Number</th>
                <th className="py-4 px-6">PSA / DDO Office & Code</th>
                <th className="py-4 px-6">Representative Name(s)</th>
                <th className="py-4 px-6">Submitted On</th>
                <th className="py-4 px-6">Entries Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-800">
              {selectedTable && getGroupedTokens().map((group) => {
                return (
                  <tr key={group.token_number} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => handleTokenClick(group.token_number)}
                        className="text-left group focus:outline-none"
                        title="Click to view all entries and individual remarks"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-govBlue group-hover:text-blue-700 underline underline-offset-2 tracking-wide text-sm font-mono">
                            {group.token_number}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-govBlue border border-blue-200">
                            {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-0.5 group-hover:text-blue-600">
                          Click to view entries & remarks
                        </span>
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900 text-xs">{group.psa_name || 'N/A'}</div>
                      {group.psa_code && (
                        <span className="inline-block mt-1 font-mono text-[10px] font-bold bg-slate-100 text-govBlue px-1.5 py-0.5 rounded border border-slate-200">
                          Code: {group.psa_code}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6 text-gray-500 font-mono text-xs">
                      {formatDateTime(group.submitted_on)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1.5">
                        {group.entries.map((e, idx) => (
                          <div key={e.entry_id || idx} className="flex items-center gap-1.5">
                            {group.entries.length > 1 && (
                              <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[90px]">
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
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleTokenClick(group.token_number)}
                        className="inline-flex items-center px-3 py-1.5 bg-govBlue hover:bg-govBlue-dark text-white rounded-lg text-xs font-bold transition duration-150 shadow-sm"
                        title="View all entries and manage remarks"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Queries ({group.entries.length})
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!selectedTable && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider">
                    Please select a table number above to view and process assigned tokens.
                  </td>
                </tr>
              )}

              {selectedTable && tokens.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400 font-bold uppercase tracking-wider">
                    No tokens assigned to {selectedTable} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: All Entries & Individual Remarks for Clicked Token */}
      {activeModalToken && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            
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
                    All representative queries clubbed under this token. Manage individual remarks and resolution for each query below.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setActiveModalToken(null)}
                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition duration-150"
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
                  const isLocked = entry.status === 'Resolved' || entry.status === 'Closed' || entry.status === 'Completed';
                  const isInProgress = entry.status === 'In Progress';
                  const currentRemarksValue = editingRemarks[entry.entry_id] !== undefined ? editingRemarks[entry.entry_id] : (entry.remarks || '');

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

                        <div className="flex items-center space-x-2">
                          <span className={`inline-block py-1 px-3 rounded-full text-xs tracking-wide uppercase ${getStatusStyle(entry.status)}`}>
                            {entry.status === 'Resolved' ? 'Completed' : entry.status}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {formatDateTime(entry.submitted_on)}
                          </span>
                        </div>
                      </div>

                      {/* Entry Remarks & Actions */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-govBlue uppercase tracking-wider">
                          Remarks for this Representative / Entry:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={currentRemarksValue}
                            onChange={(e) => setEditingRemarks({ ...editingRemarks, [entry.entry_id]: e.target.value })}
                            placeholder="Enter specific remarks for this representative..."
                            disabled={isLocked}
                            className="flex-grow py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue text-xs font-semibold"
                          />
                          <button
                            onClick={() => handleSaveEntryRemarks(entry.entry_id, activeModalToken, entry.status)}
                            disabled={isLocked}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition duration-150 flex items-center justify-center space-x-1 ${
                              isLocked
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                : 'bg-govBlue hover:bg-govBlue-dark text-white shadow-sm'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Save Remarks
                          </button>
                        </div>
                      </div>

                      {/* Status Buttons for this entry */}
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-gray-500 font-semibold">
                          Change Entry Status:
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleUpdateEntryStatus(entry.entry_id, activeModalToken, 'In Progress', currentRemarksValue)}
                            disabled={isLocked || isInProgress}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
                              isInProgress
                                ? 'bg-amber-100 text-amber-700 cursor-default border border-amber-200'
                                : isLocked
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                            }`}
                          >
                            In Progress
                          </button>
                          
                          <button
                            onClick={() => handleUpdateEntryStatus(entry.entry_id, activeModalToken, 'Resolved', currentRemarksValue)}
                            disabled={isLocked}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
                              isLocked
                                ? 'bg-emerald-100 text-emerald-700 cursor-default border border-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                          >
                            Completed
                          </button>
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
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition duration-150"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/90 py-4 px-6 rounded-xl shadow-inner flex flex-col sm:flex-row items-center justify-between text-xs tracking-wide text-gray-500 font-semibold">
        <div>
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
