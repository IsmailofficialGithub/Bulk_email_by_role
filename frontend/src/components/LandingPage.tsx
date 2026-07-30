import React from 'react';
import Link from 'next/link';
import { Mail, Zap, Shield, ChevronRight, BarChart, Settings, Search, ArrowRight, UserPlus, FileText, Send } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="animate-fade-in-up flex items-center justify-between px-6 py-4 md:px-12 max-w-7xl mx-auto">
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
        <h1 className="animate-fade-in-up delay-100 text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
          RUN YOUR BUSINESS ON <br />
          <span className="text-blue-600">AUTOPILOT</span>
        </h1>
        <p className="animate-fade-in-up delay-200 text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          The ultimate beginner-friendly software that finds customers, writes emails for you, and sends them automatically while you sleep.
        </p>
        
        <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-16">
          <Link href="/signup" className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 hover:scale-105 transform duration-200">
            Start Your Free Trial <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Dummy's Guide Section */}
      <section className="py-24 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up delay-100">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We've made Viddr so simple that anyone can use it. No coding, no complicated tech. Just follow these 5 easy steps to put your business on autopilot.
            </p>
          </div>

          <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            
            {/* Step 1 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up delay-100">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Step 1</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Create Your Account</h3>
                <p className="text-gray-600">
                  Click the <strong>Get Started</strong> button above. Enter your email address and create a password. That's it! You now have a Viddr account. It's completely free to sign up and look around.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up delay-200">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <Settings className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Step 2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Your Email (Configuration)</h3>
                <p className="text-gray-600">
                  Before Viddr can send emails for you, you need to give it permission. Go to the <strong>Settings</strong> tab in your dashboard, click "Expand", and enter your Email provider details (like Gmail or Outlook). Think of this like giving a robot the keys to your mailbox.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up delay-300">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <Search className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Step 3</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Find Contacts & Leads</h3>
                <p className="text-gray-600">
                  Now you need people to email! Go to the <strong>Scraper & Contacts</strong> tab. You can either type in email addresses manually, or turn on the "LinkedIn Scraper" in your Settings. When the scraper is on, Viddr acts like a detective and automatically finds new people for you to contact on the internet!
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up delay-400">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <FileText className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Step 4</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Set up AI Templates</h3>
                <p className="text-gray-600">
                  Instead of writing the same email 100 times, you create a "Template". Go to the <strong>Templates & AI</strong> tab. Write a basic message like "Hi, I love your work!". Our built-in Artificial Intelligence is extremely smart; it will automatically read your template and customize it perfectly for every single person you are emailing.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up delay-500">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <Send className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">Step 5</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Press Send (Automail)</h3>
                <p className="text-gray-600">
                  Finally, go to the <strong>Sending & Automail</strong> tab. Here, you can click "Start Automail". Once you do this, you can close your computer and go to the beach. Viddr will automatically write the emails using AI, and send them out one by one in the background for you. It's magic!
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Massive CTA */}
      <section className="py-24 px-6 text-center animate-fade-in-up delay-200">
        <h2 className="text-4xl md:text-6xl font-black text-gray-200 leading-none mb-12 tracking-tighter uppercase max-w-4xl mx-auto">
          Start automating your business today
        </h2>
        
        <div className="mt-12">
          <Link href="/signup" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-full font-bold text-xl transition-all shadow-xl shadow-blue-500/30 hover:scale-105 transform duration-200">
            Create Your Free Account
          </Link>
          <p className="mt-6 text-gray-500 text-sm">No credit card required. Setup takes less than 2 minutes.</p>
        </div>
      </section>
      
    </div>
  );
}
