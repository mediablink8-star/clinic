import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, Lock, X } from 'lucide-react';
import { getBillingStatus } from '../lib/billing';

/**
 * Top-of-page banner showing trial countdown, payment failure, or lockout.
 * Stays out of the way for active paying customers.
 */
const TrialBanner = ({ onUpgradeClick }) => {
    const { data: status, isLoading } = useQuery({
        queryKey: ['billing-status'],
        queryFn: getBillingStatus,
        refetchInterval: 60000,
        retry: 1,
    });

    if (isLoading || !status) return null;

    // Active paying customer — nothing to nag about
    if (status.planStatus === 'active' && !status.cancelAtPeriodEnd) return null;

    // Trial countdown (3 days or less remaining)
    if (status.isTrialing && status.daysUntilLock != null && status.daysUntilLock <= 3 && status.daysUntilLock >= 0) {
        return (
            <div style={{
                background: status.daysUntilLock <= 1
                    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white', padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                fontSize: '0.85rem', fontWeight: 700, flexWrap: 'wrap',
            }}>
                <Clock size={16} />
                <span>
                    {status.daysUntilLock === 0
                        ? 'Η δωρεάν δοκιμή σας λήγει σήμερα!'
                        : `Απομένουν ${status.daysUntilLock} ${status.daysUntilLock === 1 ? 'ημέρα' : 'ημέρες'} δωρεάν δοκιμής.`}
                </span>
                <button
                    onClick={onUpgradeClick}
                    style={{
                        padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.15)', color: 'white',
                        fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                    }}
                >Επιλογή πλάνου</button>
            </div>
        );
    }

    // Payment past due (within grace period)
    if (status.isPastDue) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white', padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                fontSize: '0.85rem', fontWeight: 700, flexWrap: 'wrap',
            }}>
                <AlertTriangle size={16} />
                <span>
                    Η πληρωμή της συνδρομής σας απέτυχε.
                    {status.daysUntilLock != null && ` Κλείδωμα λογαριασμού σε ${status.daysUntilLock} ${status.daysUntilLock === 1 ? 'ημέρα' : 'ημέρες'}.`}
                </span>
                <button
                    onClick={onUpgradeClick}
                    style={{
                        padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.15)', color: 'white',
                        fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                    }}
                >Ενημέρωση πληρωμής</button>
            </div>
        );
    }

    // Locked (trial expired or subscription cancelled/expired)
    if (status.isLocked) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: 'white', padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                fontSize: '0.85rem', fontWeight: 700, flexWrap: 'wrap',
            }}>
                <Lock size={16} />
                <span>
                    {status.planStatus === 'expired'
                        ? 'Η δωρεάν δοκιμή σας έληξε. Επιλέξτε πλάνο για να συνεχίσετε.'
                        : 'Ο λογαριασμός σας είναι κλειδωμένος. Ενεργοποιήστε μια συνδρομή για να συνεχίσετε.'}
                </span>
                <button
                    onClick={onUpgradeClick}
                    style={{
                        padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.4)',
                        background: 'rgba(255,255,255,0.15)', color: 'white',
                        fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                    }}
                >Επιλογή πλάνου</button>
            </div>
        );
    }

    return null;
};

export default TrialBanner;
