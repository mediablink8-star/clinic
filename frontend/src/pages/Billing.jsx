import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
    CreditCard, Check, Loader, AlertTriangle, Sparkles, Crown,
    Download, Receipt, ExternalLink, Clock, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getBillingStatus, getBillingPlans, startCheckout, openBillingPortal,
    cancelSubscription, resumeSubscription, getInvoices, getSubscriptionEvents
} from '../lib/billing';

const PLAN_BADGES = {
    trial:      { label: 'Δοκιμαστικό',  color: '#94a3b8', icon: Clock,    bg: 'rgba(148,163,184,0.12)' },
    starter:    { label: 'Starter',     color: '#3b82f6', icon: Sparkles, bg: 'rgba(59,130,246,0.12)' },
    growth:     { label: 'Growth',      color: '#8b5cf6', icon: Crown,    bg: 'rgba(139,92,246,0.12)' },
    scale:      { label: 'Scale',       color: '#f59e0b', icon: Crown,    bg: 'rgba(245,158,11,0.12)' },
    enterprise: { label: 'Enterprise',  color: '#ef4444', icon: Crown,    bg: 'rgba(239,68,68,0.12)' },
};

const STATUS_LABELS = {
    trialing: { label: 'Σε δοκιμή',   color: '#3b82f6' },
    active:   { label: 'Ενεργό',      color: '#10b981' },
    past_due: { label: 'Εκκρεμής πληρωμή', color: '#f59e0b' },
    cancelled:{ label: 'Ακυρωμένο',    color: '#94a3b8' },
    expired:  { label: 'Έληξε',        color: '#ef4444' },
};

function PlanBadge({ plan, planStatus }) {
    const meta = PLAN_BADGES[plan] || PLAN_BADGES.trial;
    const status = STATUS_LABELS[planStatus] || STATUS_LABELS.trialing;
    const Icon = meta.icon;
    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '99px',
                background: meta.bg, color: meta.color, fontWeight: 800, fontSize: '0.78rem',
            }}>
                <Icon size={14} /> {meta.label}
            </span>
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '99px',
                background: 'rgba(0,0,0,0.04)', color: status.color,
                fontWeight: 700, fontSize: '0.72rem',
            }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.color }} />
                {status.label}
            </span>
        </div>
    );
}

function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return '—'; }
}

function formatMoney(cents, currency = 'eur') {
    if (cents == null) return '—';
    const amount = (cents / 100).toFixed(2);
    return currency?.toUpperCase() === 'EUR' ? `€${amount}` : `${amount} ${currency?.toUpperCase()}`;
}

const Billing = ({ clinic }) => {
    const queryClient = useQueryClient();

    const statusQ = useQuery({
        queryKey: ['billing-status'],
        queryFn: getBillingStatus,
        refetchInterval: 60000,
    });
    const plansQ = useQuery({
        queryKey: ['billing-plans'],
        queryFn: getBillingPlans,
        staleTime: 5 * 60 * 1000,
    });
    const invoicesQ = useQuery({
        queryKey: ['billing-invoices'],
        queryFn: getInvoices,
    });
    const eventsQ = useQuery({
        queryKey: ['billing-events'],
        queryFn: getSubscriptionEvents,
    });

    const checkoutMut = useMutation({
        mutationFn: startCheckout,
        onSuccess: (data) => {
            if (data?.url) {
                window.location.href = data.url;
            } else {
                toast.error('Δεν ελήφθη URL πληρωμής.');
            }
        },
        onError: (err) => {
            const backendMsg = err.response?.data?.error || err.response?.data?.message;
            const status = err.response?.status;
            console.error('[Billing] checkout failed', { status, data: err.response?.data, err });
            let msg = backendMsg || 'Αποτυχία έναρξης πληρωμής.';
            if (status === 503) {
                msg = backendMsg
                    ? `Το Stripe δεν έχει ρυθμιστεί σωστά: ${backendMsg}`
                    : 'Το Stripe δεν έχει ρυθμιστεί σωστά στον διακομιστή. Επικοινωνήστε με την υποστήριξη.';
            } else if (status === 402) msg = 'Η δωρεάν δοκιμή σας έληξε ή το πλάνο σας δεν επιτρέπει αναβάθμιση.';
            else if (!err.response) msg = 'Αδυναμία σύνδεσης με τον διακομιστή.';
            toast.error(msg, { duration: 8000 });
        },
    });

    const portalMut = useMutation({
        mutationFn: openBillingPortal,
        onSuccess: (data) => {
            if (data?.url) window.location.href = data.url;
        },
        onError: (err) => toast.error(err.response?.data?.error || err.response?.data?.message || 'Αποτυχία ανοίγματος πύλης πληρωμών.'),
    });

    const cancelMut = useMutation({
        mutationFn: cancelSubscription,
        onSuccess: () => {
            toast.success('Η συνδρομή θα ακυρωθεί στο τέλος της τρέχουσας περιόδου.');
            queryClient.invalidateQueries({ queryKey: ['billing-status'] });
            queryClient.invalidateQueries({ queryKey: ['clinic'] });
        },
        onError: (err) => toast.error(err.response?.data?.error || err.response?.data?.message || 'Αποτυχία ακύρωσης.'),
    });

    const resumeMut = useMutation({
        mutationFn: resumeSubscription,
        onSuccess: () => {
            toast.success('Η συνδρομή ενεργοποιήθηκε ξανά.');
            queryClient.invalidateQueries({ queryKey: ['billing-status'] });
            queryClient.invalidateQueries({ queryKey: ['clinic'] });
        },
        onError: (err) => toast.error(err.response?.data?.error || err.response?.data?.message || 'Αποτυχία επαναφοράς.'),
    });

    const status = statusQ.data;
    const plans = plansQ.data?.plans || [];
    const currentPlan = status?.plan || clinic?.plan || 'trial';
    const isCurrentPaying = ['starter', 'growth', 'scale', 'enterprise'].includes(currentPlan);

    if (statusQ.isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
                <Loader size={32} className="spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    return (
        <div style={{ padding: '0 1rem 4rem', maxWidth: '1100px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '4px' }}>Συνδρομή & Πληρωμές</h1>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Διαχείριση πλάνου, τιμολογίων και μεθόδων πληρωμής.
            </p>

            {/* Current plan card */}
            <div style={{
                background: 'var(--glass-surface)', backdropFilter: 'var(--glass-strong)',
                borderRadius: '20px', border: '1px solid var(--border)',
                padding: '1.5rem', boxShadow: 'var(--shadow-md)', marginBottom: '1.5rem',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <CreditCard size={20} style={{ color: 'var(--primary)' }} />
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Τρέχον Πλάνο</h2>
                        </div>
                        <PlanBadge plan={currentPlan} planStatus={status?.planStatus} />
                        <div style={{ marginTop: '12px', fontSize: '0.88rem', color: 'var(--text-light)' }}>
                            {status?.isTrialing && status?.trialEndsAt && (
                                <span>Η δοκιμή σας λήγει στις <strong>{formatDate(status.trialEndsAt)}</strong>.</span>
                            )}
                            {status?.planStatus === 'active' && status?.currentPeriodEnd && (
                                <span>Επόμενη χρέωση: <strong>{formatDate(status.currentPeriodEnd)}</strong>.</span>
                            )}
                            {status?.isPastDue && (
                                <span style={{ color: '#f59e0b' }}>
                                    <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                                    Η πληρωμή απέτυχε. Ενημερώστε τη μέθοδο πληρωμής.
                                </span>
                            )}
                            {status?.isLocked && (
                                <span style={{ color: '#ef4444' }}>
                                    <Lock size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                                    Ο λογαριασμός είναι κλειδωμένος. Επιλέξτε πλάνο για να συνεχίσετε.
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        {isCurrentPaying && (
                            <button
                                onClick={() => portalMut.mutate()}
                                disabled={portalMut.isPending}
                                style={{
                                    padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border)',
                                    background: 'var(--bg-subtle)', color: 'var(--text)',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                }}
                            >
                                <ExternalLink size={14} /> Διαχείριση πληρωμής
                            </button>
                        )}
                        {status?.cancelAtPeriodEnd ? (
                            <button
                                onClick={() => resumeMut.mutate()}
                                disabled={resumeMut.isPending}
                                style={{
                                    padding: '10px 18px', borderRadius: '12px', border: 'none',
                                    background: 'var(--accent)', color: 'white',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                }}
                            >
                                Επαναφορά συνδρομής
                            </button>
                        ) : isCurrentPaying ? (
                            <button
                                onClick={() => {
                                    if (window.confirm('Θέλετε σίγουρα να ακυρώσετε τη συνδρομή σας στο τέλος της περιόδου;')) {
                                        cancelMut.mutate();
                                    }
                                }}
                                disabled={cancelMut.isPending}
                                style={{
                                    padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border)',
                                    background: 'transparent', color: 'var(--text-light)',
                                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                }}
                            >
                                Ακύρωση στο τέλος της περιόδου
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Plan grid */}
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem' }}>Διαθέσιμα Πλάνα</h3>
            <div style={{
                display: 'grid', gap: '1rem', marginBottom: '2rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}>
                {plans.filter(p => p.checkoutable).map(plan => {
                    const isCurrent = plan.key === currentPlan;
                    const isUpgrade = ['starter','growth','scale'].indexOf(plan.key) > ['starter','growth','scale'].indexOf(currentPlan);
                    return (
                        <div key={plan.key} style={{
                            background: 'var(--glass-surface)', backdropFilter: 'var(--glass-strong)',
                            borderRadius: '16px', border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                            padding: '1.25rem', position: 'relative',
                            boxShadow: isCurrent ? '0 0 0 3px rgba(59,130,246,0.15)' : 'var(--shadow-sm)',
                        }}>
                            {isCurrent && (
                                <div style={{
                                    position: 'absolute', top: '-10px', right: '12px',
                                    background: 'var(--primary)', color: 'white',
                                    padding: '3px 10px', borderRadius: '99px',
                                    fontSize: '0.7rem', fontWeight: 800,
                                }}>ΤΡΕΧΟΝ</div>
                            )}
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 4px' }}>{plan.name}</h4>
                            <p style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '0 0 12px' }}>{plan.doctorRange}</p>
                            <div style={{ marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: 900 }}>{plan.price}</span>
                                <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}> {plan.priceNote}</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', fontSize: '0.8rem' }}>
                                {plan.features.map((f, i) => (
                                    <li key={i} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => checkoutMut.mutate(plan.key)}
                                disabled={isCurrent || checkoutMut.isPending}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                                    background: isCurrent ? 'var(--bg-subtle)' : 'var(--primary)',
                                    color: isCurrent ? 'var(--text-light)' : 'white',
                                    fontWeight: 800, fontSize: '0.85rem', cursor: isCurrent ? 'default' : 'pointer',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}
                            >
                                {checkoutMut.isPending && <Loader size={14} className="spin" />}
                                {isCurrent ? 'Ενεργό' : (isUpgrade ? 'Αναβάθμιση' : 'Αλλαγή')}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Enterprise CTA */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))',
                borderRadius: '16px', border: '1px solid var(--border)',
                padding: '1.25rem', marginBottom: '2rem', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
            }}>
                <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Enterprise</h4>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        Για αλυσίδες ιατρείων με προσαρμοσμένες ανάγκες. Απεριόριστα SMS & AI, on-premise, SLA.
                    </p>
                </div>
                <a href="mailto:sales@clinicflow.app"
                    style={{
                        padding: '10px 18px', borderRadius: '10px', border: 'none',
                        background: 'var(--text)', color: 'var(--bg)',
                        fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none',
                    }}>Επικοινωνία</a>
            </div>

            {/* Invoices */}
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} /> Τιμολόγια
            </h3>
            <div style={{
                background: 'var(--glass-surface)', backdropFilter: 'var(--glass-strong)',
                borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '2rem',
            }}>
                {invoicesQ.isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}><Loader size={20} className="spin" /></div>
                ) : (invoicesQ.data?.invoices || []).length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                        Δεν υπάρχουν τιμολόγια ακόμα.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-subtle)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Αρ.</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Ημ/νία</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Ποσό</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Κατάσταση</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoicesQ.data.invoices.map(inv => (
                                <tr key={inv.id} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 14px' }}>{inv.number || inv.stripeInvoiceId.slice(-8)}</td>
                                    <td style={{ padding: '10px 14px' }}>{formatDate(inv.createdAt)}</td>
                                    <td style={{ padding: '10px 14px' }}>{formatMoney(inv.amountPaid, inv.currency)}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700,
                                            background: inv.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                            color: inv.status === 'paid' ? '#10b981' : '#f59e0b',
                                        }}>{inv.status}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                        {inv.invoicePdf ? (
                                            <a href={inv.invoicePdf} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                                <Download size={16} />
                                            </a>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Activity log */}
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem' }}>Ιστορικό Συνδρομής</h3>
            <div style={{
                background: 'var(--glass-surface)', backdropFilter: 'var(--glass-strong)',
                borderRadius: '16px', border: '1px solid var(--border)', padding: '1rem',
            }}>
                {(eventsQ.data?.events || []).length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                        Καμία δραστηριότητα ακόμα.
                    </div>
                ) : (
                    eventsQ.data.events.slice(0, 10).map(ev => (
                        <div key={ev.id} style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '8px 4px', borderBottom: '1px solid var(--border)',
                            fontSize: '0.82rem',
                        }}>
                            <span><strong>{ev.type}</strong> {ev.fromPlan && ev.toPlan ? `(${ev.fromPlan} → ${ev.toPlan})` : (ev.toPlan ? `→ ${ev.toPlan}` : '')}</span>
                            <span style={{ color: 'var(--text-light)' }}>{new Date(ev.createdAt).toLocaleString('el-GR')}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Billing;
