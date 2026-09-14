import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AdminDashboard() {
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedToken, setExpandedToken] = useState(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const navigate = useNavigate();

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/login');
    } else {
      const parsed = JSON.parse(storedUser);
      if (parsed.designation !== 'ADMIN') {
        navigate('/login');
      }
    }
  }, [navigate]);

  // Fetch all tokens with audit logs
  const fetchAdminTokens = async () => {
    try {
      const res = await axios.get('/api/tokens/admin-list');
      setTokens(res.data);
      setError('');
    } catch (err) {
      console.error('Error fetching admin token list:', err);
      setError('Connection to server lost. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  // Poll server every 5 seconds for real-time updates
  useEffect(() => {
    fetchAdminTokens();
    const pollInterval = setInterval(() => {
      fetchAdminTokens();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Filter and search tokens
  useEffect(() => {
    let result = tokens;

    // Search query check
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(tk => 
        (tk.token_number || '').toLowerCase().includes(query) ||
        (tk.psa_name || '').toLowerCase().includes(query) ||
        (tk.psa_code || '').toLowerCase().includes(query) ||
        (tk.rep_name || '').toLowerCase().includes(query)
      );
    }

    // Status filter check
    if (statusFilter !== 'ALL') {
      result = result.filter(tk => (tk.status || '').toUpperCase() === statusFilter);
    }

    setFilteredTokens(result);
  }, [tokens, searchQuery, statusFilter]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleExpand = (tokenNo) => {
    if (expandedToken === tokenNo) {
      setExpandedToken(null);
    } else {
      setExpandedToken(tokenNo);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Pending / Not Assigned';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getStatusBadgeStyle = (status) => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'RESOLVED' || normalized === 'COMPLETED' || normalized === 'CLOSED') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (normalized === 'IN PROGRESS') {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const renderServiceStepTimeline = (serviceName, status, tableNo, boName, allocatedAt, aaoName, remarks, completedAt, createdAt) => {
    if (status === null || status === undefined) return null;

    const isPending = status === 'Pending';
    const isInProgress = status === 'In Progress';
    const isResolved = status === 'Resolved' || status === 'Completed' || status === 'Closed';

    return (
      <div className="border border-slate-100 bg-slate-50/50 p-5 rounded-xl space-y-4 shadow-sm relative">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h4 className="font-extrabold text-govBlue text-sm tracking-wide uppercase">{serviceName} Service Status</h4>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase border font-black ${getStatusBadgeStyle(status)}`}>
            {status}
          </span>
        </div>

        {/* Step-by-Step Vertical Audit Timeline */}
        <div className="relative pl-6 border-l-2 border-slate-200 space-y-5 text-xs">
          
          {/* Step 1: Token Creation */}
          <div className="relative">
            <span className="absolute -left-[31px] top-0.5 bg-govBlue text-white h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] font-black border border-white">1</span>
            <div>
              <p className="font-bold text-gray-800">Token Registered</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{formatDateTime(createdAt)}</p>
              <p className="text-gray-500 mt-1 font-semibold">Service preferred and registered on system successfully.</p>
            </div>
          </div>

          {/* Step 2: Table Assignment (BO) */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0.5 h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] font-black border border-white ${
              isPending ? 'bg-slate-350 text-white' : 'bg-govBlue text-white'
            }`}>2</span>
            <div>
              <p className="font-bold text-gray-800">
                Table Allocation {isPending ? '(Pending)' : ''}
              </p>
              {!isPending && (
                <>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{formatDateTime(allocatedAt)}</p>
                  <div className="mt-1.5 space-y-1 text-gray-600 font-semibold">
                    <p>
                      <span className="text-gray-400">Allocated Table:</span>{' '}
                      <span className="font-extrabold text-govGold-dark font-mono bg-govGold/10 py-0.5 px-2.5 rounded-lg border border-govGold/20">{tableNo}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">Assigned By:</span>{' '}
                      <span className="text-gray-700 font-black">{boName || 'System BO'}</span>
                    </p>
                  </div>
                </>
              )}
              {isPending && <p className="text-gray-400 mt-1 italic font-semibold">Awaiting assignment by Branch Officer.</p>}
            </div>
          </div>

          {/* Step 3: Resolution (AAO) */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0.5 h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] font-black border border-white ${
              isResolved ? 'bg-emerald-600 text-white' : 'bg-slate-350 text-white'
            }`}>3</span>
            <div>
              <p className="font-bold text-gray-800">
                Verification & Resolution {isResolved ? '(Completed)' : (isInProgress ? '(In Progress)' : '(Pending)')}
              </p>
              {isResolved && (
                <>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{formatDateTime(completedAt)}</p>
                  <div className="mt-1.5 space-y-1 text-gray-600 font-semibold">
                    <p>
                      <span className="text-gray-400">Verified By:</span>{' '}
                      <span className="text-gray-700 font-black">{aaoName || 'System AAO'}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">AAO Remarks:</span>{' '}
                      <span className="text-gray-800 italic bg-white p-2 rounded-lg border border-slate-200 block mt-1 leading-relaxed">{remarks || 'No remarks provided.'}</span>
                    </p>
                  </div>
                </>
              )}
              {isInProgress && (
                <p className="text-amber-600 mt-1 font-semibold italic">
                  Currently undergoing verification at {tableNo}. AAO has not finalized resolution yet.
                </p>
              )}
              {isPending && <p className="text-gray-400 mt-1 italic font-semibold">Awaiting table allocation to start verification.</p>}
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="flex-grow flex flex-col w-full max-w-7xl mx-auto py-8 px-4 md:px-8 space-y-6 relative z-10 font-sans">
      
      {/* Admin Dashboard header banner */}
      <div className="bg-gradient-to-r from-govBlue to-blue-950 rounded-2xl border border-blue-900 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        
        <div className="relative z-10 text-center md:text-left space-y-2">
          <div className="flex items-center justify-center md:justify-start space-x-2">
            <span className="flex h-3.5 w-3.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-govGold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-govGold"></span>
            </span>
            <span className="text-govGold font-extrabold text-[11px] tracking-widest uppercase">SUPER ADMIN PANEL</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-serif tracking-wide">
            SAMADHAN Auditing Dashboard
          </h2>
          <p className="text-blue-100 text-xs md:text-sm font-semibold max-w-xl">
            Real-time tracking of registration tokens, step-by-step table allocations, active BO handlers, and final AAO resolution remarks.
          </p>
        </div>

        <div className="relative z-10 mt-6 md:mt-0 flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-center sm:text-left">
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Total Registers</p>
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

      {/* Filters & search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-3 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Token Number, DDO Name, DDO Code, or Representative..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
          />
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-bold text-gray-700 bg-white"
          >
            <option value="ALL">All Token Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN PROGRESS">In Progress</option>
            <option value="RESOLVED">Completed / Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Audit table */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-md overflow-hidden relative glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-150 text-govBlue font-black uppercase tracking-wider text-[11px] md:text-xs">
                <th className="py-4.5 px-6 w-[50px] text-center">Audit</th>
                <th className="py-4.5 px-6 w-[130px]">Token No</th>
                <th className="py-4.5 px-6">PSA/DDO Office Details</th>
                <th className="py-4.5 px-6 w-[170px]">Registered On</th>
                <th className="py-4.5 px-6 w-[230px]">Preferred Services</th>
                <th className="py-4.5 px-6 w-[140px] text-center">Overall Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs md:text-sm font-semibold text-gray-800">
              {filteredTokens.map((tk) => {
                const isExpanded = expandedToken === tk.token_number;
                
                // Construct preferred services status summary
                const preferredServices = [];
                if (tk.SERVICE_PENSION !== null) preferredServices.push({ name: 'Pension', status: tk.SERVICE_PENSION });
                if (tk.SERVICE_ACCOUNTS !== null) preferredServices.push({ name: 'Accounts', status: tk.SERVICE_ACCOUNTS });
                if (tk.SERVICE_GPF !== null) preferredServices.push({ name: 'GPF', status: tk.SERVICE_GPF });

                return (
                  <React.Fragment key={tk.token_number}>
                    {/* Main Row */}
                    <tr 
                      onClick={() => toggleExpand(tk.token_number)}
                      className={`hover:bg-slate-50/50 cursor-pointer transition-colors duration-150 ${isExpanded ? 'bg-slate-50/40' : ''}`}
                    >
                      {/* Collapse/Expand Toggle arrow */}
                      <td className="py-5 px-6 text-center">
                        <span className="text-gray-400">
                          <svg 
                            className={`w-4 h-4 transform transition-transform duration-200 mx-auto ${isExpanded ? 'rotate-90 text-govBlue' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="3" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </td>

                      {/* Token No */}
                      <td className="py-5 px-6 font-mono font-extrabold text-govBlue text-sm tracking-wide">
                        {tk.token_number}
                      </td>

                      {/* DDO Details */}
                      <td className="py-5 px-6">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-800 leading-tight">{tk.psa_name}</p>
                          <div className="flex items-center space-x-2 text-[11px] text-gray-400 font-bold font-mono">
                            <span>Code: {tk.psa_code}</span>
                            <span>•</span>
                            <span>Rep: {tk.rep_name || 'N/A'} ({tk.mobile || 'N/A'})</span>
                          </div>
                        </div>
                      </td>

                      {/* Registered On */}
                      <td className="py-5 px-6 text-gray-500 font-bold font-mono">
                        {formatDateTime(tk.CREATED_AT)}
                      </td>

                      {/* Preferred Services Status summary */}
                      <td className="py-5 px-6">
                        <div className="flex flex-wrap gap-1.5">
                          {preferredServices.map((srv, sIdx) => {
                            let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-100';
                            if (srv.status === 'In Progress') badgeStyle = 'bg-amber-50 text-amber-600 border-amber-100';
                            if (srv.status === 'Resolved' || srv.status === 'Completed') badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';

                            return (
                              <span 
                                key={sIdx} 
                                className={`inline-block py-0.5 px-2.5 rounded-full text-[10px] tracking-wide uppercase border font-extrabold ${badgeStyle}`}
                              >
                                {srv.name}: {srv.status || 'Pending'}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Overall Status */}
                      <td className="py-5 px-6 text-center">
                        <span className={`inline-block py-1 px-3 rounded-full text-[10px] tracking-wider uppercase border font-extrabold ${getStatusBadgeStyle(tk.status)}`}>
                          {tk.status || 'Pending'}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Audit Log Details Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="6" className="bg-slate-50/30 p-6 border-t border-b border-slate-100">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                              <h3 className="text-sm font-black text-govBlue uppercase tracking-wider flex items-center space-x-2">
                                <svg className="w-5 h-5 text-govGold" fill="currentColor" viewBox="0 0 24 24">
                                  <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
                                </svg>
                                <span>Token Audit Lifecycle Log — {tk.token_number}</span>
                              </h3>
                              <span className="text-gray-400 font-mono text-[10px] font-bold">CREATED: {formatDateTime(tk.CREATED_AT)}</span>
                            </div>

                            {/* Service Lifecycles side-by-side or stacked */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Pension Audit Log */}
                              {tk.SERVICE_PENSION !== null ? (
                                renderServiceStepTimeline(
                                  'Pension',
                                  tk.SERVICE_PENSION,
                                  tk.TABLE_PENSION,
                                  tk.BO_PENSION,
                                  tk.ALLOCATED_AT_PENSION,
                                  tk.AAO_PENSION,
                                  tk.REMARKS_PENSION,
                                  tk.COMPLETED_AT_PENSION,
                                  tk.CREATED_AT
                                )
                              ) : (
                                <div className="border border-dashed border-slate-200 p-5 rounded-xl flex items-center justify-center text-center">
                                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Pension service not selected</p>
                                </div>
                              )}

                              {/* Accounts Audit Log */}
                              {tk.SERVICE_ACCOUNTS !== null ? (
                                renderServiceStepTimeline(
                                  'Accounts',
                                  tk.SERVICE_ACCOUNTS,
                                  tk.TABLE_ACCOUNTS,
                                  tk.BO_ACCOUNTS,
                                  tk.ALLOCATED_AT_ACCOUNTS,
                                  tk.AAO_ACCOUNTS,
                                  tk.REMARKS_ACCOUNTS,
                                  tk.COMPLETED_AT_ACCOUNTS,
                                  tk.CREATED_AT
                                )
                              ) : (
                                <div className="border border-dashed border-slate-200 p-5 rounded-xl flex items-center justify-center text-center">
                                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Accounts service not selected</p>
                                </div>
                              )}

                              {/* GPF Audit Log */}
                              {tk.SERVICE_GPF !== null ? (
                                renderServiceStepTimeline(
                                  'GPF',
                                  tk.SERVICE_GPF,
                                  tk.TABLE_GPF,
                                  tk.BO_GPF,
                                  tk.ALLOCATED_AT_GPF,
                                  tk.AAO_GPF,
                                  tk.REMARKS_GPF,
                                  tk.COMPLETED_AT_GPF,
                                  tk.CREATED_AT
                                )
                              ) : (
                                <div className="border border-dashed border-slate-200 p-5 rounded-xl flex items-center justify-center text-center">
                                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">GPF service not selected</p>
                                </div>
                              )}
                            </div>

                            {/* Contact Card Details */}
                            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-semibold text-gray-700">
                              <div>
                                <span className="text-gray-400 uppercase text-[10px] block mb-0.5">DDO Address Details</span>
                                <span className="text-gray-800">{tk.address || 'Address not listed'}</span>
                              </div>
                              <div className="flex gap-6 flex-shrink-0">
                                <div>
                                  <span className="text-gray-400 uppercase text-[10px] block mb-0.5">Official Email</span>
                                  <span className="text-gray-800 font-mono">{tk.email || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 uppercase text-[10px] block mb-0.5">Representative Name</span>
                                  <span className="text-gray-800">{tk.rep_name || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {loading && filteredTokens.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-govBlue border-t-transparent"></div>
                      <p className="text-gray-400 font-extrabold uppercase tracking-wider text-xs">Loading Token Audit Lifecycle Database...</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredTokens.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-gray-400">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-black uppercase tracking-wider text-sm">No Audit Records Found</p>
                      <p className="text-gray-400 text-xs max-w-sm mx-auto">No tokens match your search criteria or filter status.</p>
                    </div>
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

export default AdminDashboard;
