import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Ban } from 'lucide-react';
import { getClinicDateKey, getClinicTimePart } from '../lib/dateUtils';
import { getGreekHolidays } from '../lib/greekHolidays';
import Skeleton from '../components/Skeleton';
import { DEFAULT_TIMEZONE } from '../lib/constants';

const CalendarView = ({ appointments = [], onAppointmentClick, gcalConnected = false, clinic, loading }) => {
    const timezone = clinic?.timezone || DEFAULT_TIMEZONE;
    const [currentDate, setCurrentDate] = useState(new Date());

    // Group appointments by date (in clinic timezone)
    const appointmentsByDate = useMemo(() => {
        const grouped = {};
        appointments.forEach(apt => {
            if (!apt.startTime) return;
            const dateKey = getClinicDateKey(apt.startTime, timezone);
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(apt);
        });
        // Sort appointments within each day
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        });
        return grouped;
    }, [appointments, timezone]);

    // Greek holidays for visible period
    const holidays = useMemo(() => {
        const year = currentDate.getFullYear();
        return { ...getGreekHolidays(year - 1), ...getGreekHolidays(year), ...getGreekHolidays(year + 1) };
    }, [currentDate]);

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

    if (loading) {
        return <div style={{ padding: '2rem' }}><Skeleton height="100px" borderRadius="24px" style={{ marginBottom: '1.5rem' }} /><Skeleton height="400px" borderRadius="24px" /></div>;
    }

    // Navigation
    const goToPreviousMonth = () => {
        const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(prev);
    };

    const goToNextMonth = () => {
        const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(next);
    };

    const goToToday = () => {
        const now = new Date();
        setCurrentDate(now);
    };

    // Render calendar grid
    const renderMonthView = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];
        const today = getClinicDateKey(new Date(), timezone);

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            // Construct the date key manually to avoid any browser timezone day-shifting
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            const dateKey = `${y}-${m}-${d}`;
            
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const isToday = dateKey === today;
            const holiday = holidays[dateKey];

            const holidayStyles = holiday ? {
                bg: holiday.type === 'holiday'
                    ? 'rgba(239,68,68,0.06)'
                    : 'rgba(251,191,36,0.06)',
                border: holiday.type === 'holiday'
                    ? '1px solid rgba(239,68,68,0.2)'
                    : '1px solid rgba(251,191,36,0.15)',
                dayColor: holiday.type === 'holiday'
                    ? '#ef4444'
                    : '#d97706'
            } : null;

            days.push(
                <div 
                    key={day} 
                    className={`calendar-day ${isToday ? 'today' : ''} ${dayAppointments.length > 0 ? 'has-appointments' : ''}`}
                    title={holiday ? holiday.name : ''}
                    onClick={() => {
                        if (dayAppointments.length > 0) {
                            onAppointmentClick?.(dayAppointments[0]);
                        }
                    }}
                    style={{
                        minHeight: '100px',
                        padding: '8px',
                        border: holidayStyles ? holidayStyles.border : '1px solid var(--border)',
                        borderRadius: '8px',
                        background: holidayStyles ? holidayStyles.bg : isToday ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)',
                        cursor: dayAppointments.length > 0 ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                    }}>
                        <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: isToday ? '800' : holiday ? '700' : '600',
                            color: holidayStyles ? holidayStyles.dayColor : isToday ? 'var(--primary)' : 'var(--text)',
                        }}>
                            {day}
                        </span>
                        {holiday && (
                            <Ban size={10} style={{
                                color: holidayStyles.dayColor,
                                opacity: 0.6
                            }} />
                        )}
                    </div>
                    {holiday && (
                        <div style={{
                            fontSize: '0.6rem',
                            fontWeight: '700',
                            color: holidayStyles.dayColor,
                            marginBottom: '6px',
                            lineHeight: '1.3',
                            opacity: 0.8
                        }}>
                            {holiday.name}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayAppointments.slice(0, 3).map(apt => {
                            let styleConfig = {
                                bg: 'rgba(148,163,184,0.1)',
                                text: '#64748b',
                                border: 'rgba(148,163,184,0.2)'
                            };
                            if (apt.status === 'CONFIRMED') {
                                styleConfig = {
                                    bg: 'rgba(16,185,129,0.1)',
                                    text: '#10b981',
                                    border: 'rgba(16,185,129,0.2)'
                                };
                            } else if (apt.status === 'COMPLETED') {
                                styleConfig = {
                                    bg: 'rgba(99,102,241,0.1)',
                                    text: '#6366f1',
                                    border: 'rgba(99,102,241,0.2)'
                                };
                            } else if (apt.status === 'PENDING') {
                                styleConfig = {
                                    bg: 'rgba(245,158,11,0.1)',
                                    text: '#f59e0b',
                                    border: 'rgba(245,158,11,0.2)'
                                };
                            } else if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') {
                                styleConfig = {
                                    bg: 'rgba(239,68,68,0.1)',
                                    text: '#ef4444',
                                    border: 'rgba(239,68,68,0.2)'
                                };
                            }

                            return (
                                <div
                                    key={apt.id}
                                    onClick={() => onAppointmentClick?.(apt)}
                                    style={{
                                        fontSize: '0.7rem',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                        background: styleConfig.bg,
                                        color: styleConfig.text,
                                        fontWeight: '700',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: styleConfig.border
                                    }}
                                >
                                    <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
                                    {getClinicTimePart(apt.startTime, timezone)}
                                    {' '}
                                    {apt.patient?.name || 'Ασθενής'}
                                </div>
                            );
                        })}
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
