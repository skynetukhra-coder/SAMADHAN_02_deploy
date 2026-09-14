import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'REGISTRATION',
      description: 'Register yourself to access various services and facilities.',
      buttonText: 'Proceed',
      icon: (
        <svg className="w-12 h-12 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {/* Custom SVG: Clipboard with profile and pen */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <circle cx="12" cy="11" r="1.5" stroke="currentColor" fill="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 16h6M9 18h4" />
          <path d="M17 11.5l1.5 1.5-3 3H14v-1.5l3-3z" fill="currentColor" />
        </svg>
      ),
      themeColor: 'emerald',
      action: () => navigate('/register'),
      btnBg: 'bg-emerald-800 hover:bg-emerald-900 text-white',
      borderColor: 'border-emerald-500/30',
      circleBorder: 'border-emerald-500',
      dotColor: 'bg-emerald-600',
      textColor: 'text-emerald-800',
      lineColor: 'bg-emerald-600'
    },
    {
      title: 'FEEDBACK',
      description: 'Share your feedback and help us improve our services.',
      buttonText: 'Provide Feedback',
      icon: (
        <svg className="w-12 h-12 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
          {/* Custom SVG: Speech bubble with three dots */}
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm0 4h8v2H6v-2z" />
          <circle cx="9" cy="10" r="1.2" fill="white" />
          <circle cx="13" cy="10" r="1.2" fill="white" />
          <circle cx="17" cy="10" r="1.2" fill="white" />
        </svg>
      ),
      themeColor: 'blue',
      action: () => navigate('/feedback'),
      btnBg: 'bg-blue-800 hover:bg-blue-900 text-white',
      borderColor: 'border-blue-500/30',
      circleBorder: 'border-blue-500',
      dotColor: 'bg-blue-600',
      textColor: 'text-blue-800',
      lineColor: 'bg-blue-600'
    },
    {
      title: 'LOGIN / TABLE ALLOCATE',
      description: 'Login to your account or allocate a table.',
      buttonText: 'Login / Allocate',
      icon: (
        <svg className="w-12 h-12 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {/* Custom SVG: Desk with laptop and chair */}
          <circle cx="12" cy="7" r="2.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 13.5h13a1 1 0 011 1V16H4.5v-1.5a1 1 0 011-1z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18v2.5H3z" />
          <path d="M6 18v-4.5h12V18" />
        </svg>
      ),
      themeColor: 'purple',
      action: () => navigate('/login'),
      btnBg: 'bg-purple-800 hover:bg-purple-900 text-white',
      borderColor: 'border-purple-500/30',
      circleBorder: 'border-purple-500',
      dotColor: 'bg-purple-600',
      textColor: 'text-purple-800',
      lineColor: 'bg-purple-700'
    }
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-6xl mx-auto w-full">
      
      {/* Title & Subtitle block */}
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-extrabold text-govBlue font-serif tracking-normal mb-2">
          Welcome to SAMADHAN
        </h2>
        
        {/* Diamond decoration */}
        <div className="flex items-center justify-center my-3 text-govGold">
          <span className="text-sm">♦</span>
        </div>
        
        <p className="text-govBlue font-black text-lg md:text-2xl max-w-4xl mx-auto leading-normal mt-4">
          सरल एकीकृत मध्यम अभिलेख-निधि-पेंशन दोष-हल, आश्वासन एवं निवारण
        </p>
      </div>

      {/* 3 cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-2">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl p-8 flex flex-col items-center justify-between shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100/90 relative"
          >
            {/* Outline Circle for Icon */}
            <div className={`w-28 h-28 rounded-full border-2 ${card.circleBorder} flex items-center justify-center bg-slate-50/50 shadow-sm mb-4`}>
              {card.icon}
            </div>

            {/* Small Color Dot */}
            <div className={`w-2.5 h-2.5 rounded-full ${card.dotColor} mb-4`}></div>

            {/* Decorative Divider Line: line with dot in center */}
            <div className="w-full flex items-center justify-center mb-5">
              <div className={`h-[1.5px] w-20 ${card.lineColor} opacity-70`}></div>
              <div className={`w-1.5 h-1.5 rounded-full ${card.dotColor} mx-1`}></div>
              <div className={`h-[1.5px] w-20 ${card.lineColor} opacity-70`}></div>
            </div>

            {/* Title & Description */}
            <div className="flex-1 flex flex-col justify-start text-center mb-6">
              <h3 className={`${card.textColor} font-extrabold text-base md:text-lg tracking-wider uppercase mb-3 font-sans`}>
                {card.title}
              </h3>
              <p className="text-gray-600 text-xs md:text-sm font-semibold leading-relaxed max-w-[220px] mx-auto">
                {card.description}
              </p>
            </div>

            {/* Button */}
            <button
              onClick={card.action}
              className={`w-full py-3 px-4 rounded-lg font-bold text-xs md:text-sm tracking-wider uppercase shadow-sm transition-colors duration-200 flex items-center justify-center space-x-2 ${card.btnBg}`}
            >
              <span>{card.buttonText}</span>
              <span className="text-sm font-bold">&rarr;</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
