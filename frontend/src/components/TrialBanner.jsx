import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, Lock, X } from 'lucide-react';
import { getBillingStatus } from '../lib/billing';

/**
 * Top-of-page banner showing trial countdown, payment failure, or lockout.
 * Stays out of the way for active paying customers.
 */
const TrialBanner = ({ onUpgradeClick }) => {
    const [dismissed, setDismissed] = React.useState(false);
    const { data: status, isLoading } = useQuery({
        queryKey: ['billing-status'],
        queryFn: getBillingStatus,
        refetchInterval: 60000,
        retry: 1,
    });

    if (isLoading || !status || dismissed) return null;

    // Active paying customer — nothing to nag about
    if (status.planStatus === 'active' && !status.cancelAtPeriodEnd) return null;

    // Trial countdown (3 days or less remaining)
    const bannerBase = {
        padding: '9px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        fontSize: '0.82rem', fontWeight: 700, flexWrap: 'wrap',
    };
    const upgradeBtn = {
        padding: '4px 14px', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.12)', color: 'white',
        fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
        backdropFilter: 'blur(8px)',
    };

    if (status.isTrialing && status.daysUntilLock != null && status.daysUntilLock <= 3 && status.daysUntilLock >= 0) {
        const urgent = status.daysUntilLock <= 1;
        return (
            <div style={{
                ...bannerBase,
                background: urgent
                    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                position: 'relative',
            }}>
                <Clock size={14} />
                <span>
                    {status.daysUntilLock === 0
                        ? 'Η δωρεάν δοκιμή σας λήγει σήμερα!'
                        : `Απομένουν ${status.daysUntilLock} ${status.daysUntilLock === 1 ? 'ημέρα' : 'ημέρες'} δωρεάν δοκιμής.`}
                </span>
                <button onClick={onUpgradeClick} style={upgradeBtn}>Επιλογή πλάνου</button>
                <button
                    onClick={() => setDismissed(true)}
                    aria-label="Κλείσιμο"
                    style={{
                        position: 'absolute', right: '12px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.7)', padding: '4px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'white'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                >
                    <X size={15} />
                </button>
            </div>
        );
    }

    // Payment past due (within grace period)
    if (status.isPastDue) {
        return (
            <div style={{
                ...bannerBase,
                background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                color: 'white',
            }}>
                <AlertTriangle size={14} />
                <span>
                    Η πληρωμή της συνδρομής σας απέτυχε.
                    {status.daysUntilLock != null && ` Κλείδωμα σε ${status.daysUntilLock} ${status.daysUntilLock === 1 ? 'ημέρα' : 'ημέρες'}.`}
                </span>
                <button onClick={onUpgradeClick} style={upgradeBtn}>Ενημέρωση πληρωμής</button>
            </div>
        );
    }

    // Locked
    if (status.isLocked) {
        return (
            <div style={{
                ...bannerBase,
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                color: 'white',
            }}>
                <Lock size={14} />
                <span>
                    {status.planStatus === 'expired'
                        ? 'Η δωρεάν δοκιμή σας έληξε. Επιλέξτε πλάνο για να συνεχίσετε.'
                        : 'Ο λογαριασμός σας είναι κλειδωμένος. Ενεργοποιήστε μια συνδρομή για να συνεχίσετε.'}
                </span>
                <button onClick={onUpgradeClick} style={upgradeBtn}>Επιλογή πλάνου</button>
            </div>
        );
    }

    return null;
};

export default TrialBanner;
