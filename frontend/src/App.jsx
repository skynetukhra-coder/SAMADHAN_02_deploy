import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import Feedback from './pages/Feedback';
import BoDashboard from './pages/BoDashboard';
import AaoDashboard from './pages/AaoDashboard';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col relative bg-transparent">
        {/* Fixed Blurred Background Image Watermark */}
        <div className="watermark-bg" />

        {/* Global Government Header */}
        <Header />

        {/* Dynamic Route Pages */}
        <main className="flex-1 flex flex-col w-full">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/dashboard" element={<BoDashboard />} />
            <Route path="/bo_dashboard" element={<BoDashboard />} />
            <Route path="/aao_dashboard" element={<AaoDashboard />} />
            <Route path="/user_dashboard" element={<UserDashboard />} />
            <Route path="/admin_dashboard" element={<AdminDashboard />} />
          </Routes>
        </main>

        {/* Global Government Footer */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;
