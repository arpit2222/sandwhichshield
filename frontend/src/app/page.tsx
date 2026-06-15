"use client";

import React, { useEffect, useState, useRef } from 'react';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Helper interface for typing the alerts from our new API
interface Alert {
  id: string;
  victim: string;
  attacker: string;
  lossUSD: number;
  aiScore: number;
  txHash: string;
  timestamp: number;
  dexName: string;
}

interface Stat {
  dexName: string;
  attackCount: number;
  totalLoss: number;
}

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const previousAlertCount = useRef(0);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const totalLoss24h = stats.reduce((acc, stat) => acc + stat.totalLoss, 0);
  const totalAttacks = stats.reduce((acc, stat) => acc + stat.attackCount, 0);

  useEffect(() => {
    async function fetchApiData() {
      try {
        // Fetch from the Agent Backend API
        const alertsRes = await fetch(`${API_BASE}/api/alerts`);
        const statsRes = await fetch(`${API_BASE}/api/stats`);

        if (!alertsRes.ok || !statsRes.ok) {
            throw new Error("Failed to connect to Backend API");
        }

        const alertsData: Alert[] = await alertsRes.json();
        const statsData: Stat[] = await statsRes.json();

        // Trigger Toast for new alerts
        if (previousAlertCount.current > 0 && alertsData.length > previousAlertCount.current) {
            const diff = alertsData.length - previousAlertCount.current;
            for(let i=0; i<Math.min(diff, 10); i++) {
               const newAlert = alertsData[i];
               toast.error(`🚨 $${newAlert.lossUSD.toLocaleString(undefined, {minimumFractionDigits: 2})} Extracted by ${newAlert.attacker.substring(0,6)}...`, {
                 description: `AI Threat Score: ${newAlert.aiScore}/100`,
                 duration: 8000,
               });
            }
        }
        previousAlertCount.current = alertsData.length;

        setAlerts(alertsData);
        setStats(statsData);
        setError("");
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch data from Backend Indexer. Ensure the Agent is running.");
        setLoading(false);
      }
    }

    fetchApiData();
    
    // Poll API every 3 seconds for extremely fast live updates
    const interval = setInterval(fetchApiData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/10 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">SandwichShield</h1>
              <p className="text-sm text-indigo-400 font-medium">V2 Industry Indexer</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {error ? (
               <div className="px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20">
                 <span className="text-rose-400 text-sm font-medium">API Offline</span>
               </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Backend Sync Active</span>
              </div>
            )}
          </div>
        </header>

        {error && (
            <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex justify-between items-center">
                <span>{error}</span>
                <span className="text-xs opacity-70">Hint: Start the agent `npm start`</span>
            </div>
        )}

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden relative group">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 uppercase tracking-wider text-xs font-semibold">Total Value Lost</CardDescription>
              <CardTitle className="text-4xl font-light text-white">
                ${totalLoss24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden relative group">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 uppercase tracking-wider text-xs font-semibold">Attacks Indexed</CardDescription>
              <CardTitle className="text-4xl font-light text-white">{totalAttacks}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden relative group">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 uppercase tracking-wider text-xs font-semibold">Avg. Loss Per Attack</CardDescription>
              <CardTitle className="text-4xl font-light text-white">
                ${totalAttacks > 0 ? (totalLoss24h / totalAttacks).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Alerts List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Indexed MEV Attacks
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">BGA Public Good</Badge>
              </h2>
              <div className="flex gap-2">
                <a href={`${API_BASE}/api/export/nansen`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center">Nansen Export</a>
                <Badge variant="outline" className="text-indigo-400 border-indigo-400/30 bg-indigo-400/10">MongoDB Cluster</Badge>
              </div>
            </div>
            
            <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/50">Time</TableHead>
                    <TableHead className="text-white/50">Victim</TableHead>
                    <TableHead className="text-white/50">Attacker</TableHead>
                    <TableHead className="text-white/50">DEX</TableHead>
                    <TableHead className="text-white/60">AI Score</TableHead>
                    <TableHead className="text-right text-white/50">Loss (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-white/50">Connecting to database...</TableCell></TableRow>}
                  {!loading && alerts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-white/50">No attacks in database. Run the Simulator!</TableCell></TableRow>
                  )}
                  {alerts.map((alert) => {
                    const date = new Date(alert.timestamp * 1000);
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return (
                    <TableRow key={alert.id} className="border-white/10 hover:bg-white/5 transition-colors group cursor-default">
                      <TableCell className="font-medium text-white/70">{timeString}</TableCell>
                      <TableCell className="font-mono text-xs text-indigo-300">{alert.victim.substring(0, 6)}...{alert.victim.substring(38)}</TableCell>
                      <TableCell className="font-mono text-xs text-rose-300">{alert.attacker.substring(0, 6)}...{alert.attacker.substring(38)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20">{alert.dexName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          alert.aiScore >= 90 ? "text-red-400 border-red-400/30 bg-red-400/10" : 
                          alert.aiScore >= 75 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" : 
                          "text-green-400 border-green-400/30 bg-green-400/10"
                        }>
                          {alert.aiScore || 85} / 100
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-rose-400">${alert.lossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Leaderboard */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">DEX Leaderboard</h2>
            <div className="space-y-4">
              {!loading && stats.length === 0 && (
                  <div className="text-white/50 text-sm">No DEX data available yet.</div>
              )}
              {stats.map((stat, idx) => (
                <Card key={idx} className="bg-black/40 border-white/10 backdrop-blur-md hover:border-white/20 transition-all hover:translate-y-[-2px] cursor-default">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white/60 mb-1">{stat.dexName}</div>
                      <div className="text-2xl font-semibold text-white">${stat.totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md inline-block mb-1">
                        {stat.attackCount} attacks
                      </div>
                      <div className="text-xs text-white/40">~${(stat.totalLoss / stat.attackCount).toFixed(2)}/ea</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden mt-6">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full"></div>
               <h3 className="text-sm font-semibold text-indigo-300 mb-2 flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 V2 Architecture
               </h3>
               <p className="text-xs text-white/60 leading-relaxed relative z-10 mb-2">
                 The <strong>Backend Indexer</strong> scans blocks for the 3-tx sandwich pattern and saves attacks to a <strong>MongoDB Cluster</strong>. 
               </p>
               <p className="text-xs text-white/60 leading-relaxed relative z-10">
                 The Smart Contract only accepts a gasless <strong>Daily Merkle Root</strong> to prove integrity.
               </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
