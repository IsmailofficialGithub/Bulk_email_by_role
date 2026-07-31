"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, Zap, Shield, ChevronRight, BarChart, Settings, Search, UserPlus, FileText, Send, CheckCircle2 } from 'lucide-react';

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 overflow-x-hidden">
      
      {/* Navigation */}
      <FadeIn>
        <nav className="flex items-center justify-between px-6 py-4 md:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Viddr Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="font-bold text-xl tracking-tight">Viddr</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium text-sm transition-colors shadow-sm">
              Get started
            </Link>
          </div>
        </nav>
      </FadeIn>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6 text-center max-w-5xl mx-auto relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-100/50 rounded-full blur-[100px] -z-10 opacity-70"></div>
        <FadeIn delay={100}>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-6">
            RUN YOUR BUSINESS ON <br />
            <span className="text-blue-600">AUTOPILOT</span>
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            The ultimate beginner-friendly software that finds customers, writes emails for you, and sends them automatically while you sleep.
          </p>
        </FadeIn>
        
        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-20">
            <Link href="/signup" className="w-full sm:w-auto whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30 hover:scale-105 transform duration-200">
              Start Your Free Trial <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </FadeIn>

        {/* Dashboard Mockup (Brought back to make it look large and impressive) */}
        <FadeIn delay={400}>
          <div className="relative mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-100 bg-gray-50 max-w-4xl aspect-[16/9] flex flex-col group hover:shadow-blue-500/10 transition-shadow duration-500">
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
            <div className="flex-1 p-6 flex gap-6 bg-slate-50">
              <div className="w-48 hidden md:flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-4">
                  <img src="/logo.png" className="w-6 h-6 rounded" />
                  <span className="font-bold text-gray-800">Viddr</span>
                </div>
                <div className="h-8 bg-blue-100/50 rounded-lg w-full"></div>
                <div className="h-8 bg-transparent border border-gray-200 rounded-lg w-full"></div>
                <div className="h-8 bg-transparent border border-gray-200 rounded-lg w-full"></div>
                <div className="h-8 bg-transparent border border-gray-200 rounded-lg w-full"></div>
              </div>
              <div className="flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-8 bg-blue-600 rounded-lg w-32 shadow-sm"></div>
                </div>
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
                  <div className="h-10 bg-gray-50 rounded-lg mb-4 border border-gray-100"></div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex gap-4 items-center p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-100 rounded flex-1"></div>
                        <div className="h-4 bg-green-100 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                  {/* Overlay gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"></div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-white relative">
        <div className="absolute inset-0 bg-blue-50/50 skew-y-3 -z-10 transform origin-top-left"></div>
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
                Powerful Automation at Your Fingertips
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Viddr connects directly to LinkedIn and your inbox to automate the entire outreach pipeline, from finding recruiters to writing the emails.
              </p>
            </div>
          </FadeIn>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FadeIn delay={100} className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">LinkedIn Keyword Scraper</h3>
              <p className="text-gray-600 text-sm">Automatically search LinkedIn for specific keywords and instantly extract targeted profiles and emails into your CRM.</p>
            </FadeIn>
            
            <FadeIn delay={200} className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Auto-Extract Recruiters</h3>
              <p className="text-gray-600 text-sm">Find hiring managers and recruiters from any company page. Let the system pull their contact info while you sleep.</p>
            </FadeIn>
            
            <FadeIn delay={300} className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Mail Sender</h3>
              <p className="text-gray-600 text-sm">Our AI analyzes every single LinkedIn profile and writes a highly personalized, custom email for each person automatically.</p>
            </FadeIn>
            
            <FadeIn delay={400} className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Auto Job Apply</h3>
              <p className="text-gray-600 text-sm">Don't waste time clicking apply. Automatically submit applications and send follow-up emails to the hiring team in the background.</p>
            </FadeIn>
          </div>
          
          {/* LinkedIn Image Showcase */}
          <FadeIn delay={500}>
            <div className="mt-16 bg-slate-900 rounded-3xl p-8 md:p-12 overflow-hidden relative shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
              <div className="md:flex items-center gap-12 relative z-10">
                <div className="md:w-1/2 mb-8 md:mb-0">
                  <h3 className="text-3xl font-bold text-white mb-4">Deep LinkedIn Integration</h3>
                  <p className="text-blue-200 text-lg">
                    Viddr runs invisibly alongside your LinkedIn session. We automatically fetch cookies, search queries, and profiles without requiring complex API keys or manual data entry.
                  </p>
                </div>
                <div className="md:w-1/2">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform">
                    {/* Dummy LinkedIn Image UI */}
                    <div className="bg-white rounded-lg overflow-hidden">
                      <div className="bg-[#0077b5] text-white p-3 flex items-center gap-3">
                        <div className="font-bold text-xl ml-2 tracking-tighter">in</div>
                        <div className="bg-white/20 h-8 flex-1 rounded text-sm px-3 flex items-center">Search "Software Engineer"</div>
                      </div>
                      <div className="p-4 flex gap-4 border-b border-gray-100">
                        <div className="w-16 h-16 bg-gray-200 rounded-full shrink-0"></div>
                        <div>
                          <div className="h-5 w-40 bg-gray-800 rounded mb-2"></div>
                          <div className="h-3 w-60 bg-gray-400 rounded mb-2"></div>
                          <div className="h-3 w-32 bg-gray-300 rounded"></div>
                        </div>
                        <div className="ml-auto">
                          <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg shadow-blue-500/50 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Auto-Extracting...
                          </div>
                        </div>
                      </div>
                      <div className="p-4 flex gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-full shrink-0"></div>
                        <div>
                          <div className="h-5 w-32 bg-gray-800 rounded mb-2"></div>
                          <div className="h-3 w-48 bg-gray-400 rounded mb-2"></div>
                          <div className="h-3 w-24 bg-gray-300 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Dummy's Guide Section */}
      <section className="py-24 px-6 bg-slate-900 text-white border-y border-slate-800 relative overflow-hidden">
        {/* Cool background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                How It Works (Step-by-Step)
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                We've made Viddr so simple that anyone can use it. No coding, no complicated tech. Just follow these 5 easy steps to put your business on autopilot.
              </p>
            </div>
          </FadeIn>

          <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-500/50 before:to-transparent">
            
            {/* Step 1 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <FadeIn className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                <UserPlus className="w-5 h-5" />
              </FadeIn>
              <FadeIn delay={150} className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-8 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 transition-all hover:bg-slate-800 hover:border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-3 py-1 rounded-full">Step 1</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Create Your Account</h3>
                <p className="text-slate-300 leading-relaxed">
                  Click the <strong>Get Started</strong> button above. Enter your email address and create a password. That's it! You now have a Viddr account. It's completely free to sign up and look around.
                </p>
              </FadeIn>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <FadeIn className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                <Settings className="w-5 h-5" />
              </FadeIn>
              <FadeIn delay={150} className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-8 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 transition-all hover:bg-slate-800 hover:border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-3 py-1 rounded-full">Step 2</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Connect Your Email (Configuration)</h3>
                <p className="text-slate-300 leading-relaxed">
                  Before Viddr can send emails for you, you need to give it permission. Go to the <strong>Settings</strong> tab in your dashboard, click "Expand", and enter your Email provider details. Think of this like giving a robot the keys to your mailbox!
                </p>
              </FadeIn>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <FadeIn className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                <Search className="w-5 h-5" />
              </FadeIn>
              <FadeIn delay={150} className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-8 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 transition-all hover:bg-slate-800 hover:border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-3 py-1 rounded-full">Step 3</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Find Contacts & Leads</h3>
                <p className="text-slate-300 leading-relaxed">
                  Now you need people to email! Go to the <strong>Scraper & Contacts</strong> tab. You can type in email addresses manually, or turn on the "LinkedIn Scraper" in your Settings. When the scraper is on, Viddr acts like a detective and automatically finds new people for you!
                </p>
              </FadeIn>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <FadeIn className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                <FileText className="w-5 h-5" />
              </FadeIn>
              <FadeIn delay={150} className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-8 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 transition-all hover:bg-slate-800 hover:border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-3 py-1 rounded-full">Step 4</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Set up AI Templates</h3>
                <p className="text-slate-300 leading-relaxed">
                  Instead of writing the same email 100 times, you create a "Template". Go to the <strong>Templates & AI</strong> tab. Write a basic message like "Hi, I love your work!". Our Artificial Intelligence will automatically read your template and customize it perfectly for every single person.
                </p>
              </FadeIn>
            </div>

            {/* Step 5 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <FadeIn className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                <Send className="w-5 h-5" />
              </FadeIn>
              <FadeIn delay={150} className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-8 bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700/50 transition-all hover:bg-slate-800 hover:border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-3 py-1 rounded-full">Step 5</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Press Send (Automail)</h3>
                <p className="text-slate-300 leading-relaxed">
                  Finally, go to the <strong>Sending & Automail</strong> tab. Click "Start Automail". Once you do this, you can close your computer and go to the beach. Viddr will automatically write the emails using AI, and send them out one by one in the background for you. It's magic!
                </p>
              </FadeIn>
            </div>

          </div>
        </div>
      </section>

      {/* Massive CTA */}
      <section className="py-32 px-6 text-center relative overflow-hidden bg-slate-50 border-t border-slate-200">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-multiply"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[120px] -z-10"></div>
        
        <FadeIn className="relative z-10">
          <h2 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] mb-8 tracking-tight max-w-4xl mx-auto">
            Ready to take control of your time?
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">
            Join thousands of smart founders who use Viddr to automate their outreach and scale their business on autopilot.
          </p>
        </FadeIn>
        
        <FadeIn delay={200} className="mt-14 relative z-10">
          <Link href="/signup" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-12 py-5 rounded-full font-bold text-xl transition-all shadow-2xl shadow-blue-500/30 hover:scale-105 transform duration-200 hover:-translate-y-1 border border-blue-500">
            Get Started Now &rarr;
          </Link>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-slate-600 font-semibold text-sm">
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"><CheckCircle2 className="w-5 h-5 text-blue-600" /> Free Trial</span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"><CheckCircle2 className="w-5 h-5 text-blue-600" /> No Credit Card</span>
            <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"><CheckCircle2 className="w-5 h-5 text-blue-600" /> Cancel Anytime</span>
          </div>
        </FadeIn>
      </section>
      
    </div>
  );
}
