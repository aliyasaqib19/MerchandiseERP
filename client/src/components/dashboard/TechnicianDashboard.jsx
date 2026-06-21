import {
  FolderKanban, CalendarCheck, ClipboardList, CheckCircle,
  CalendarPlus, BookOpen, FileText,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';

const STATS = [
  { label: 'Assigned Projects',   value: '6',   sub: '2 in progress',             icon: FolderKanban,  color: 'blue',   trend: null },
  { label: 'Upcoming Site Visits',value: '4',   sub: 'Next: Tomorrow 9:00 AM',    icon: CalendarCheck, color: 'green',  trend: null },
  { label: 'Pending Work Logs',   value: '3',   sub: 'Submit before end of day',  icon: ClipboardList, color: 'orange', trend: 'up', trendValue: '+1' },
  { label: 'Completed This Month',value: '14',  sub: 'tasks & site visits',       icon: CheckCircle,   color: 'teal',   trend: 'up', trendValue: '+5' },
];

const ACTIVITY = [
  { type: 'project',  message: 'You were assigned to "Branch D Fiber Termination"',  time: '30 min ago' },
  { type: 'project',  message: 'Site visit for "HQ Network Room" confirmed — Mon 10 AM', time: '2 hours ago' },
  { type: 'project',  message: 'Work log submitted for "Cabling – Floor 3"',          time: '4 hours ago' },
  { type: 'project',  message: 'Service report #SR-0021 approved by manager',         time: 'Yesterday' },
  { type: 'project',  message: 'Task "Cable testing – Zone B" marked complete',       time: 'Yesterday' },
  { type: 'alert',    message: 'Reminder: Submit site visit report for Project #P-14', time: '2 days ago' },
];

const QUICK_ACTIONS = [
  { label: 'Log Work',         icon: BookOpen,      to: '/projects/work-logs',      primary: true },
  { label: 'Site Visit',       icon: CalendarPlus,  to: '/projects/site-visits',    primary: false },
  { label: 'Service Report',   icon: FileText,      to: '/projects/service-reports',primary: false },
  { label: 'My Projects',      icon: FolderKanban,  to: '/projects/assigned',       primary: false },
];

export function TechnicianDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed items={ACTIVITY} />
        </div>
        <div>
          <QuickActions actions={QUICK_ACTIONS} />
        </div>
      </div>
    </div>
  );
}
