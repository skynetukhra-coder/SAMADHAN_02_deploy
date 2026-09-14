import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Footer() {
  const location = useLocation();

  // Hide the global dark navy footer on the admin dashboard
  // since the dashboard renders its own light-themed footer inline.
  if (location.pathname === '/dashboard') {
    return null;
  }

  return (
    <footer className="bg-govBlue text-white border-t border-govGold py-4 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between mt-auto relative z-10 text-xs tracking-wide">
      <div className="mb-2 sm:mb-0 opacity-80">
        &copy; 2024 SAMADHAN. All rights reserved.
      </div>
      
      <div className="flex items-center space-x-4 opacity-90">
        <a href="#privacy" className="hover:text-govGold-light transition-colors">Privacy Policy</a>
        <span className="text-govGold">|</span>
        <a href="#terms" className="hover:text-govGold-light transition-colors">Terms of Use</a>
        <span className="text-govGold">|</span>
        <a href="#contact" className="hover:text-govGold-light transition-colors">Contact Us</a>
      </div>
    </footer>
  );
}
