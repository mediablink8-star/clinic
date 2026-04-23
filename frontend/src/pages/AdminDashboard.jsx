import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Database, Plus, ShieldCheck, TrendingUp, Search } from 'lucide-react';
import { getAccessToken } from '../lib/authSession';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function AdminDashboard({ token }) {
    const [clinics, setClinics] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClinic, setSelectedClinic] = useState(null);
    const [topupAmount, setTopupAmount] = useState(100);

    useEffect(() => {
        fetchUsage();
    }, []);

    const fetchUsage = async () => {
        const authToken = token || getAccessToken();
        if (!authToken) {
            setLoading(false);
            return;
        }
        try {
            const config = { headers: { Authorization: `Bearer ${authToken}` } };
            const [usageRes, logsRes] = await Promise.all([
                axios.get(`${API_BASE}/admin/usage`, config),
                axios.get(`${API_BASE}/admin/logs`, config)
            ]);
            setClinics(usageRes.data);
            setLogs(logsRes.data);
        } catch (err) {
            console.error('Failed to fetch usage data');
        } finally {
            setLoading(false);
        }
    };

    const handleTopup = async (clinicId) => {
        const authToken = token || getAccessToken();
        if (!authToken) {
            toast.error('Η συνεδρία έληξε. Ανανεώστε τη σελίδα.');
            return;
        }
        try {
            await axios.post(`${API_BASE}/admin/add-credits`, {
                clinicId,
                amount: topupAmount
            }, { headers: { Authorization: `Bearer ${authToken}` } });
            fetchUsage();
            setSelectedClinic(null);
            toast.success('Πιστώθηκαν μονάδες!');
        } catch (err) {
            toast.error('Αποτυχία προσθήκης μονάδων');
        }
    };

    const filteredClinics = clinics.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Command Center</h1>
                        <p className="text-gray-500 mt-1">Manage infrastructure, credits, and usage.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full border border-green-200">
                        <ShieldCheck size={18} />
                        <span className="font-semibold text-sm">System Healthy</span>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                                <Database size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Clinics</p>
                                <p className="text-2xl font-bold">{clinics.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Global Usage</p>
                                <p className="text-2xl font-bold">
                                    {clinics.reduce((acc, c) => acc + c.totalUsedCredits, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search & Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search clinics..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Clinic</th>
                                    <th className="px-6 py-4 font-semibold text-center">Remaining</th>
                                    <th className="px-6 py-4 font-semibold text-center">Monthly Limit</th>
                                    <th className="px-6 py-4 font-semibold text-center">Daily Used</th>
                                    <th className="px-6 py-4 font-semibold text-center">Daily Cap</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredClinics.map((clinic) => (
                                    <tr key={clinic.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{clinic.name}</div>
                                            <div className="text-xs text-gray-500">Reset: {new Date(clinic.creditResetDate).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full font-bold ${clinic.messageCredits < 20 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {clinic.messageCredits}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {clinic.monthlyCreditLimit}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={clinic.dailyUsedCount >= clinic.dailyMessageCap ? 'text-red-600 font-bold' : ''}>
                                                {clinic.dailyUsedCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-400">
                                            {clinic.dailyMessageCap}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedClinic(clinic)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Message Logs */}
                <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-900">Live Traffic Logs</h2>
                        <div className="text-sm text-gray-500">Showing last 50 events</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Time</th>
                                    <th className="px-6 py-4 font-semibold">Clinic</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold">Error</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-6 py-4 font-medium">{log.clinic?.name}</td>
                                        <td className="px-6 py-4">{log.type}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${log.status === 'SENT' ? 'bg-green-100 text-green-700' :
                                                log.status === 'BLOCKED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-red-500 truncate max-w-xs" title={log.error}>
                                            {log.error}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Topup Modal */}
            {selectedClinic && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-2">Add Credits</h2>
                        <p className="text-gray-500 mb-6">Top up for <span className="font-semibold text-gray-900">{selectedClinic.name}</span></p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Amount</label>
                                <input
                                    type="number"
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedClinic(null)}
                                    className="flex-1 py-3 text-gray-500 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleTopup(selectedClinic.id)}
                                    className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
