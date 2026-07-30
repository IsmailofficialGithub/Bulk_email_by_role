import React from 'react';
import Link from 'next/link';
import { Mail, Zap, Shield, ChevronRight, BarChart, Settings, Search } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Viddr Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-xl tracking-tight">Viddr</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium text-sm transition-colors">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6 text-center max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
          RUN ON <br />
          <span className="text-blue-600">AUTOPILOT</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Automate your workflow, fetch leads effortlessly, and send personalized campaigns with zero friction.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-16">
          <input 
            type="email" 
            placeholder="Enter your email" 
            className="w-full px-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Link href="/signup" className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-colors flex items-center justify-center gap-2">
            Try for free <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard Mockup */}
        <div className="relative mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-100 bg-gray-50 max-w-4xl aspect-[16/9] flex flex-col">
          {/* Mac-like Header */}
          <div className="bg-white border-b border-gray-100 p-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="mx-auto bg-gray-100 rounded-md px-4 py-1 text-xs text-gray-400 flex items-center gap-2">
              <Shield className="w-3 h-3" /> viddr.ismailabbasi.qzz.io
            </div>
          </div>
          {/* Dashboard Body */}
          <div className="flex-1 p-6 flex gap-6">
            <div className="w-48 hidden md:flex flex-col gap-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-8 bg-blue-100 rounded w-32"></div>
              </div>
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="h-10 bg-gray-50 rounded mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-100 rounded flex-1"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blue Feature Section */}
      <section className="bg-blue-600 text-white py-24 px-6 mt-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-full mb-6">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-8 leading-tight">
            Your assistant works at your pace, so you can get back to being busy.
          </h2>
          <div className="grid md:grid-cols-2 gap-8 text-left max-w-2xl mx-auto mt-12">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-300 shrink-0 mt-1" />
              <p className="text-blue-100">Fetch leads instantly and automatically build your contact lists.</p>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-300 shrink-0 mt-1" />
              <p className="text-blue-100">Send personalized, role-based campaigns with AI-crafted templates.</p>
            </div>
            <div className="flex items-start gap-3">
              <BarChart className="w-5 h-5 text-blue-300 shrink-0 mt-1" />
              <p className="text-blue-100">Track execution logs and monitor success rates in real-time.</p>
            </div>
            <div className="flex items-start gap-3">
              <Search className="w-5 h-5 text-blue-300 shrink-0 mt-1" />
              <p className="text-blue-100">Discover unseen opportunities using integrated data scraping tools.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Detail Section */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                All your time consuming workflows, handled by Viddr.
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Focus on closing deals and building relationships. Our intelligent automation pipeline handles the tedious task of prospecting, formatting, and emailing entirely in the background.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-700 font-medium">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                  Automated Contact Fetching
                </li>
                <li className="flex items-center gap-3 text-gray-700 font-medium">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                  Smart SMTP Configuration
                </li>
                <li className="flex items-center gap-3 text-gray-700 font-medium">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                  Background Execution
                </li>
              </ul>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-100 bg-white p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                  <div className="font-semibold text-gray-900">Campaign Execution</div>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Active</span>
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">Campaign #{1000 + i} Sent</div>
                      <div className="text-xs text-gray-500">Delivered successfully</div>
                    </div>
                    <div className="text-xs font-medium text-gray-400">Just now</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Massive CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-5xl md:text-7xl font-black text-gray-200 leading-none mb-12 tracking-tighter uppercase max-w-5xl mx-auto">
          Everything you need to run your business on autopilot
        </h2>
        
        <div className="mt-16">
          <div className="inline-flex items-center justify-center p-4 bg-blue-50 rounded-full mb-6">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-6">Ready to begin?</h3>
          <Link href="/signup" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-colors shadow-lg shadow-blue-500/30">
            Get Started Now
          </Link>
        </div>
      </section>
      
    </div>
  );
}
