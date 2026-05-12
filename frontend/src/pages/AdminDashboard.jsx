import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Building2, Users, Calendar, MessageSquare, Plus, Check, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClinic, setNewClinic] = useState({
        name: '',
        ownerEmail: '',
        ownerPassword: '',
        ownerName: ''
    });
    const [isCreating, setIsCreating] = useState(false);

    const { data: clinics = [], isLoading, error } = useQuery({
        queryKey: ['admin-clinics'],
        queryFn: () => api.get('/admin/usage').then(res => res.data),
        refetchInterval: 30000
    });

    const { data: logs = [] } = useQuery({
        queryKey: ['admin-logs'],
        queryFn: () => api.get('/admin/logs').then(res => res.data),
        refetchInterval: 15000
    });

    const handleCreateClinic = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await api.post('/admin/clinics', newClinic);
            toast.success('Clinic created successfully!');
            setShowCreateModal(false);
            setNewClinic({ name: '', ownerEmail: '', ownerPassword: '', ownerName: '' });
            queryClient.invalidateQueries(['admin-clinics']);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create clinic');
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center">Loading Admin Control Plane...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2">
                        <ShieldAlert className="text-primary" /> Admin Control Plane
                    </h1>
                    <p className="text-sm text-gray-500 font-medium">Manage platform-wide clinics and usage</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus size={18} /> Create New Clinic
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-glass p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Clinics</p>
                            <p className="text-2xl font-black">{clinics.length}</p>
                        </div>
                    </div>
                </div>
                {/* Add more stats here if needed */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Building2 size={20} /> Clinics List
                    </h2>
                    <div className="card-glass overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Clinic</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Usage (Credits/Daily)</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Stats</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {clinics.map(clinic => (
                                    <tr key={clinic.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold">{clinic.name}</div>
                                            <div className="text-xs text-gray-400">{clinic.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold">
                                                {clinic.messageCredits} / {clinic.monthlyCreditLimit}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                Daily: {clinic.dailyUsedCount} / {clinic.dailyMessageCap}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-4 text-xs font-medium text-gray-500">
                                                <span className="flex items-center gap-1"><Users size={12} /> {clinic._count.users}</span>
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {clinic._count.appointments}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {clinic.isActive ? (
                                                <span className="badge badge-success text-[10px]">Active</span>
                                            ) : (
                                                <span className="badge badge-error text-[10px]">Inactive</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <MessageSquare size={20} /> Recent Logs
                    </h2>
                    <div className="card-glass p-4 space-y-4 max-h-[600px] overflow-y-auto">
                        {logs.map(log => (
                            <div key={log.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                                <div className="flex justify-between font-bold">
                                    <span>{log.clinic.name}</span>
                                    <span className={log.status === 'SENT' ? 'text-green-500' : 'text-red-500'}>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="text-gray-400 flex justify-between mt-1">
                                    <span>{log.type} Cost: {log.cost}</span>
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="card-glass w-full max-w-md p-6 space-y-6 bg-white dark:bg-gray-900">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black">Create New Clinic</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateClinic} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Clinic Name</label>
                                <input 
                                    required
                                    className="input w-full"
                                    value={newClinic.name}
                                    onChange={e => setNewClinic({...newClinic, name: e.target.value})}
                                    placeholder="e.g. Athens Health Center"
                                />
                            </div>
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-black text-primary uppercase mb-3">Owner Details</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Owner Name</label>
                                        <input 
                                            required
                                            className="input w-full"
                                            value={newClinic.ownerName}
                                            onChange={e => setNewClinic({...newClinic, ownerName: e.target.value})}
                                            placeholder="Full Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Owner Email</label>
                                        <input 
                                            required
                                            type="email"
                                            className="input w-full"
                                            value={newClinic.ownerEmail}
                                            onChange={e => setNewClinic({...newClinic, ownerEmail: e.target.value})}
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Owner Password</label>
                                        <input 
                                            required
                                            type="password"
                                            className="input w-full"
                                            value={newClinic.ownerPassword}
                                            onChange={e => setNewClinic({...newClinic, ownerPassword: e.target.value})}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isCreating}
                                className="btn btn-primary w-full py-3 font-bold"
                            >
                                {isCreating ? 'Creating...' : 'Create Clinic & Owner Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
