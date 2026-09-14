import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Feedback() {
  const navigate = useNavigate();
  const [tokensList, setTokensList] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  
  // Auto-fetched fields
  const [ddoName, setDdoName] = useState('Auto fetched');
  const [ddoCode, setDdoCode] = useState('Auto fetched');
  const [repName, setRepName] = useState('Auto fetched');
  const [mobile, setMobile] = useState('Auto fetched');
  const [email, setEmail] = useState('Auto fetched');
  const [address, setAddress] = useState('Auto fetched');

  // Mobile Verification states
  const [actualMobile, setActualMobile] = useState('');
  const [inputMobile, setInputMobile] = useState('');
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [mobileError, setMobileError] = useState('');

  // Star ratings
  const [pensionRating, setPensionRating] = useState(0);
  const [accountsRating, setAccountsRating] = useState(0);
  const [gpfRating, setGpfRating] = useState(0);

  // Hover ratings
  const [pensionHover, setPensionHover] = useState(0);
  const [accountsHover, setAccountsHover] = useState(0);
  const [gpfHover, setGpfHover] = useState(0);

  // Available service categories flags
  const [hasPension, setHasPension] = useState(true);
  const [hasAccounts, setHasAccounts] = useState(true);
  const [hasGpf, setHasGpf] = useState(true);

  // Suggestions
  const [comments, setComments] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch token list
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await axios.get('/api/tokens');
        setTokensList(res.data);
      } catch (err) {
        console.error('Error fetching tokens list:', err);
        setTokensList([]);
      }
    };
    fetchTokens();
  }, []);

  const handleTokenChange = async (e) => {
    const val = e.target.value;
    setSelectedToken(val);
    
    // Reset mobile verification states
    setInputMobile('');
    setIsMobileVerified(false);
    setMobileError('');
    setActualMobile('');

    if (!val) {
      setDdoName('Auto fetched');
      setDdoCode('Auto fetched');
      setRepName('Auto fetched');
      setMobile('Auto fetched');
      setEmail('Auto fetched');
      setAddress('Auto fetched');
      setHasPension(true);
      setHasAccounts(true);
      setHasGpf(true);
      return;
    }

    try {
      const res = await axios.get(`/api/tokens/${val}/details`);
      const data = res.data;
      setDdoName(data.psa_ddo);
      setDdoCode(data.psa_ddo_code);
      setRepName(data.rep_name);
      setMobile(data.mobile);
      setActualMobile(data.mobile || '');
      setEmail(data.email);
      setAddress(data.address);
      setHasPension(data.hasPension !== undefined ? data.hasPension : true);
      setHasAccounts(data.hasAccounts !== undefined ? data.hasAccounts : true);
      setHasGpf(data.hasGpf !== undefined ? data.hasGpf : true);
    } catch (err) {
      console.error('Failed to fetch token details:', err);
      setDdoName('Not found');
      setDdoCode('');
      setRepName('');
      setMobile('');
      setEmail('');
      setAddress('');
      setHasPension(false);
      setHasAccounts(false);
      setHasGpf(false);
    }
  };

  const handleVerifyMobile = (e) => {
    e.preventDefault();
    setMobileError('');
    setError('');

    const cleanInput = inputMobile.trim();
    const cleanActual = (actualMobile || '').trim();

    if (!cleanInput) {
      setMobileError('Please enter your mobile number.');
      return;
    }

    if (cleanInput === cleanActual) {
      setIsMobileVerified(true);
      setMobileError('');
    } else {
      setMobileError('Mobile number does not match registered representative details.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedToken) {
      setError('Please select a Token Number.');
      return;
    }

    if (pensionRating === 0 && accountsRating === 0 && gpfRating === 0) {
      setError('Please rate your experience for at least one category.');
      return;
    }

    if (!comments.trim()) {
      setError('Feedback / Suggestions cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        token_number: selectedToken,
        rating_pension: pensionRating,
        rating_accounts: accountsRating,
        rating_gpf: gpfRating,
        comments
      };

      await axios.post('/api/feedback', payload);
      setSuccess('Feedback submitted successfully! Thank you.');
      
      setSelectedToken('');
      setDdoName('Auto fetched');
      setDdoCode('Auto fetched');
      setRepName('Auto fetched');
      setMobile('Auto fetched');
      setEmail('Auto fetched');
      setAddress('Auto fetched');
      setPensionRating(0);
      setAccountsRating(0);
      setGpfRating(0);
      setComments('');

      setIsMobileVerified(false);
      setInputMobile('');
      setActualMobile('');
      setMobileError('');

      try {
        const res = await axios.get('/api/tokens');
        setTokensList(res.data);
      } catch (fetchErr) {
        console.error('Error reloading tokens:', fetchErr);
      }

      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit feedback. Server error.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating, setRating, hoverRating, setHoverRating) => {
    return (
      <div className="flex justify-center space-x-2 mt-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none transition-colors cursor-pointer"
            >
              {/* Gold star path matching target design */}
              <svg className={`w-6 h-6 ${isFilled ? 'fill-govGold text-govGold' : 'text-gray-300 hover:text-govGold-light'}`} fill={isFilled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.9 1.56-.9 1.86 0l1.286 3.97a1 1 0 00.95.69h4.18c.95 0 1.344 1.24.57 1.81l-3.388 2.46a1 1 0 00-.364 1.118l1.286 3.97c.3.9-.755 1.688-1.54 1.118l-3.388-2.46a1 1 0 00-1.176 0l-3.388 2.46c-.784.57-1.838-.218-1.539-1.118l1.288-3.97a1 1 0 00-.364-1.118L2.05 9.397c-.775-.57-.38-1.81.57-1.81h4.18a1 1 0 00.95-.69l1.286-3.97z" />
              </svg>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-10 px-4 w-full max-w-5xl mx-auto">
      <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-150 p-10 relative z-10 glass-card">
        
        {/* Title and Logo Header */}
        <div className="text-center mb-8 pb-5 border-b border-gray-100">
          <div className="w-14 h-14 bg-blue-50 rounded-full border-2 border-blue-500 flex items-center justify-center mx-auto mb-3 shadow-inner text-blue-600">
            {/* Outline Speech bubble icon */}
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-govBlue font-serif">
            FEEDBACK FORM
          </h2>
          <div className="flex items-center justify-center my-2 text-govGold">
            <span className="text-xs">♦</span>
          </div>
          <p className="text-gray-500 text-xs font-semibold tracking-wider">
            Your feedback helps us improve our services and serve you better.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs md:text-sm rounded-lg flex items-start space-x-2">
            <span className="font-bold">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-3.5 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs md:text-sm rounded-lg flex items-start space-x-2">
            <span className="font-bold">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Token Number Selection */}
          <div className="max-w-md mx-auto">
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              Token Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                {/* Ticket Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </span>
              <select
                value={selectedToken}
                onChange={handleTokenChange}
                className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
                required
              >
                <option value="">Select your token number</option>
                {tokensList.map((tk) => (
                  <option key={tk.token_number} value={tk.token_number}>
                    {tk.token_number} - {tk.psa_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Verification Challenge */}
          {selectedToken && !isMobileVerified && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center animate-transition max-w-lg mx-auto shadow-sm">
              <div className="w-12 h-12 bg-govGold/10 rounded-full flex items-center justify-center mx-auto mb-3 text-govGold">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-govBlue font-bold text-sm tracking-wide mb-1">Mobile Verification Required</h4>
              <p className="text-xs text-gray-500 mb-4">Please enter the registered mobile number of the representative to verify identity.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={inputMobile}
                    onChange={(e) => setInputMobile(e.target.value.replace(/\D/g, '').substring(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800 font-mono tracking-wider text-center"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyMobile}
                  className="bg-govGold hover:bg-govGold-dark text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider shadow transition duration-150"
                >
                  Verify
                </button>
              </div>
              {mobileError && (
                <span className="block mt-2.5 text-xs text-red-500 font-bold tracking-wide">{mobileError}</span>
              )}
            </div>
          )}

          {/* Form Content Unlocked only when Verified */}
          {selectedToken && isMobileVerified && (
            <div className="space-y-6 pt-4 border-t border-gray-150 animate-transition">
              
              {/* Verification Success Banner */}
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl py-3 px-4 flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-xs md:text-sm font-bold text-emerald-800 uppercase tracking-wider">Identity Verified Successfully</span>
              </div>

              {/* DDO Representative Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PSA / DDO */}
                <div>
                  <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
                    PSA / DDO (Office / Department)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      {/* Building Icon */}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={ddoName}
                      readOnly
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-450 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* PSA DDO Code */}
                <div>
                  <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
                    PSA / DDO Code (if any)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      {/* ID Card Icon */}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 014 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.333 0 4 1 4 2v1H5v-1c0-1 2.667-2 4-2z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={ddoCode}
                      readOnly
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-455 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Your Name */}
                <div>
                  <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
                    Your Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      {/* User Icon */}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={repName}
                      readOnly
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-455 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                      {/* Mail Icon */}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={email}
                      readOnly
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-455 cursor-not-allowed"
                    />
                  </div>
                </div>

              </div>

              {/* Full-width Office Address */}
              <div>
                <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
                  Office Address, District & PIN Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 flex items-start text-gray-400">
                    {/* Location Pin Icon */}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <textarea
                    value={address}
                    readOnly
                    rows="2"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-455 cursor-not-allowed resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Section 2: Star Experience Matrix Ratings */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <span className="text-govBlue font-bold text-xs uppercase tracking-wider">Rate Your Experience</span>
                  <span className="text-red-500 font-extrabold text-sm">*</span>
                </div>
                <div className={`grid grid-cols-1 ${
                  (hasPension ? 1 : 0) + (hasAccounts ? 1 : 0) + (hasGpf ? 1 : 0) === 1
                    ? 'md:grid-cols-1 max-w-sm mx-auto'
                    : (hasPension ? 1 : 0) + (hasAccounts ? 1 : 0) + (hasGpf ? 1 : 0) === 2
                    ? 'md:grid-cols-2 max-w-2xl mx-auto'
                    : 'md:grid-cols-3'
                } gap-6`}>
                  
                  {/* PENSION */}
                  {hasPension && (
                    <div className="border border-gray-200 rounded-2xl p-5 text-center bg-white shadow-sm flex flex-col justify-between items-center animate-transition">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <span className="font-extrabold text-xs tracking-widest text-emerald-800 uppercase">PENSION</span>
                      {renderStars(pensionRating, setPensionRating, pensionHover, setPensionHover)}
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2 block select-none">Click to rate</span>
                    </div>
                  )}
      
                  {/* ACCOUNTS */}
                  {hasAccounts && (
                    <div className="border border-gray-200 rounded-2xl p-5 text-center bg-white shadow-sm flex flex-col justify-between items-center animate-transition">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2 border border-blue-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                      </div>
                      <span className="font-extrabold text-xs tracking-widest text-blue-800 uppercase">ACCOUNTS</span>
                      {renderStars(accountsRating, setAccountsRating, accountsHover, setAccountsHover)}
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2 block select-none">Click to rate</span>
                    </div>
                  )}
      
                  {/* GPF */}
                  {hasGpf && (
                    <div className="border border-gray-200 rounded-2xl p-5 text-center bg-white shadow-sm flex flex-col justify-between items-center animate-transition">
                      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-2 border border-purple-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <span className="font-extrabold text-xs tracking-widest text-purple-800 uppercase">GPF</span>
                      {renderStars(gpfRating, setGpfRating, gpfHover, setGpfHover)}
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2 block select-none">Click to rate</span>
                    </div>
                  )}
      
                </div>
              </div>

              {/* Section 3: Feedback Textarea */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="block text-govBlue text-xs font-bold uppercase tracking-wider">Your Feedback / Suggestions</span>
                  <span className="text-red-500 font-extrabold text-sm">*</span>
                </div>
                
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 flex items-start text-gray-400 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value.substring(0, 1000))}
                    placeholder="Please share your feedback, suggestion or issue in detail..."
                    rows="4"
                    maxLength="1000"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
                    required
                  ></textarea>
                </div>
                
                {/* Character counter */}
                <div className="flex justify-end text-[10px] text-gray-400 font-bold tracking-widest mt-1.5 uppercase">
                  {comments.length} / 1000 characters
                </div>
              </div>

              {/* Centered Submit Button */}
              <div className="pt-6 border-t border-gray-100 flex justify-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-govBlue hover:bg-govBlue-dark text-white font-bold py-3.5 px-8 rounded-lg tracking-wider uppercase text-sm shadow transition duration-200 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 fill-current transform rotate-45 -mt-0.5" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                      <span>SUBMIT FEEDBACK</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </form>
      </div>
    </div>
  );
}
