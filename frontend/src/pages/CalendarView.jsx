import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Phone, MapPin } from 'lucide-react';

const CalendarView = ({ appointments = [], onAppointmentClick, gcalConnected = false }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Calendar helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const monthNames = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 
                        'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];

    const dayNames = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];

    // Group appointments by date
    const appointmentsByDate = useMemo(() => {
        const grouped = {};
        appointments.forEach(apt => {
            if (!apt.startTime) return;
            const dateKey = new Date(apt.startTime).toISOString().split('T')[0];
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(apt);
        });
        // Sort appointments within each day
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        });
        return grouped;
    }, [appointments]);

    // Navigation
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Render calendar grid
    const renderMonthView = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];
        const today = new Date().toISOString().split('T')[0];

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const isToday = dateKey === today;

            days.push(
                <div 
                    key={day} 
                    className={`calendar-day ${isToday ? 'today' : ''} ${dayAppointments.length > 0 ? 'has-appointments' : ''}`}
                    style={{
                        minHeight: '100px',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: isToday ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)',
                        cursor: dayAppointments.length > 0 ? 'pointer' : 'default',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: isToday ? '800' : '600',
                        color: isToday ? 'var(--primary)' : 'var(--text)',
                        marginBottom: '6px'
                    }}>
                        {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayAppointments.slice(0, 3).map(apt => (
                            <div
                                key={apt.id}
                                onClick={() => onAppointmentClick?.(apt)}
                                style={{
                                    fontSize: '0.7rem',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: apt.status === 'CONFIRMED' ? 'rgba(16,185,129,0.1)' : 
                                               apt.status === 'PENDING' ? 'rgba(251,191,36,0.1)' : 
                                               'rgba(148,163,184,0.1)',
                                    color: apt.status === 'CONFIRMED' ? '#10b981' : 
                                           apt.status === 'PENDING' ? '#f59e0b' : 
                                           'var(--text-light)',
                                    fontWeight: '600',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: apt.status === 'CONFIRMED' ? 'rgba(16,185,129,0.2)' : 
                                                apt.status === 'PENDING' ? 'rgba(251,191,36,0.2)' : 
                                                'rgba(148,163,184,0.2)'
                                }}
                            >
                                <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
                                {new Date(apt.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                                {' '}
                                {apt.patient?.name || 'Ασθενής'}
                            </div>
                        ))}
                        {dayAppointments.length > 3 && (
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-light)',
                                fontWeight: '700',
                                textAlign: 'center',
                                padding: '2px'
                            }}>
                                +{dayAppointments.length - 3} ακόμα
                            </div>
                        )}
                </div>
            </div>
            )}
            );
        }

        return days;
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            padding: '1.5rem',
            gap: '1rem'
        }}>
            {/* Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h1 style={{ 
                        fontSize: '1.75rem', 
                        fontWeight: '900', 
                        color: 'var(--secondary)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <CalendarIcon size={28} color="var(--primary)" />
                        Ημερολόγιο
                    </h1>
                    <p style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-light)',
                        fontWeight: '600'
                    }}>
                        Προβολή και διαχείριση ραντεβού
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={goToToday}
                        className="btn btn-outline"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                        Σήμερα
                    </button>
                    <button
                        onClick={goToPreviousMonth}
                        className="btn btn-outline"
                        style={{ padding: '8px 12px' }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={goToNextMonth}
                        className="btn btn-outline"
                        style={{ padding: '8px 12px' }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Month/Year Display */}
            <div style={{
                background: 'var(--card-bg)',
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <h2 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '800',
                    color: 'var(--secondary)',
                    textAlign: 'center'
                }}>
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
            </div>

            {/* Google Calendar Integration Notice */}
            {gcalConnected && (
            <div style={{
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <CalendarIcon size={20} color="var(--primary)" />
                <div>
                    <p style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: '700',
                        color: 'var(--primary)',
                        marginBottom: '2px'
                    }}>
                        Συγχρονισμός Google Calendar Ενεργός
                    </p>
                    <p style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-light)',
                        fontWeight: '600'
                    }}>
                        Τα ραντεβού σας συγχρονίζονται αυτόματα. Διαχειριστείτε τη σύνδεση από τις Ρυθμίσεις.
                    </p>
                </div>
            </div>
            )}

            {/* Calendar Grid */}
            <div style={{
                background: 'var(--card-bg)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                flex: 1,
                overflow: 'auto'
            }}>
                {/* Day headers */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '8px',
                    marginBottom: '12px'
                }}>
                    {dayNames.map(day => (
                        <div
                            key={day}
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                color: 'var(--text-light)',
                                textAlign: 'center',
                                padding: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar days */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '8px'
                }}>
                    {renderMonthView()}
                </div>
            </div>

            {/* Stats Footer */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
            }}>
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.15)'
                }}>
                    <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>
                        Επιβεβαιωμένα
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>
                        {appointments.filter(a => a.status === 'CONFIRMED').length}
                    </p>
                </div>
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.15)'
                }}>
                    <p style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '700', marginBottom: '4px' }}>
                        Σε Αναμονή
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f59e0b' }}>
                        {appointments.filter(a => a.status === 'PENDING').length}
                    </p>
                </div>
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.15)'
                }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>
                        Σύνολο Μήνα
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                        {Object.keys(appointmentsByDate).filter(date => {
                            const d = new Date(date);
                            return d.getMonth() === currentDate.getMonth() && 
                                   d.getFullYear() === currentDate.getFullYear();
                        }).reduce((sum, date) => sum + appointmentsByDate[date].length, 0)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
