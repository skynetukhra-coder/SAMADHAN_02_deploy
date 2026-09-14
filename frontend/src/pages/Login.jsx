import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/login', {
        identifier,
        password
      });

      const loggedInUser = {
        ...response.data.user,
        rep_name: response.data.user?.full_name || response.data.user?.rep_name
      };
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      
      const designation = response.data.user?.designation;
      if (designation === 'Asst. Accounts Officer' || designation === 'ASSTT. ACCOUNTS OFFICER') {
        navigate('/aao_dashboard');
      } else if (designation === 'USER') {
        navigate('/user_dashboard');
      } else if (designation === 'ADMIN') {
        navigate('/admin_dashboard');
      } else {
        navigate('/bo_dashboard');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Login failed. Please verify credentials.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-16 px-4">
      {/* Login Card Panel Container */}
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-150 relative z-10 p-10 flex flex-col justify-between">
        
        {/* Profile Circle Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-govBlue rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border-2 border-white">
            {/* Person avatar SVG matching target mockup */}
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.75 16.65c0-2.43 1.92-4.4 4.35-4.4h7.8c2.43 0 4.35 1.97 4.35 4.4V18a1 1 0 01-1 1H4.75a1 1 0 01-1-1v-1.35z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-extrabold text-govBlue font-serif">
            Welcome Back!
          </h2>
          <p className="text-gray-500 text-xs font-semibold tracking-wide mt-1.5 uppercase">
            Please login to continue to Samadhan Portal
          </p>
        </div>

        {/* Error Alert Panel */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 mt-[1px] flex-shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {/* Input Fields Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Identifier Input */}
          <div>
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              Mobile Number / Email ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter mobile number or email"
                className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-govBlue text-xs font-bold uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-11 pr-11 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-govBlue/45 text-sm font-semibold text-gray-800"
                required
              />
              
              {/* Show/Hide eye button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-govBlue focus:ring-govBlue border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="remember_me" className="ml-2.5 block text-xs text-gray-600 font-bold select-none cursor-pointer">
              Remember me
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-govBlue hover:bg-govBlue-dark text-white font-bold py-3.5 px-4 rounded-lg tracking-wider uppercase text-sm shadow transition duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                </svg>
                <span>LOGIN</span>
              </>
            )}
          </button>
        </form>

        {/* Security Assured Badging inside card footer block */}
        <div className="mt-8 pt-6 border-t border-gray-150 flex items-center justify-center space-x-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          <ShieldCheck className="w-5 h-5 text-govBlue" />
          <span>Your data is secured with the highest standards of security</span>
        </div>

      </div>
    </div>
  );
}
