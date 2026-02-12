
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, TaskStep, AIResponse, Teammate, User, UserRole, TaskStats, Comment, TaskPriority, Notification, NotificationType, Tenant } from './types';
import { distillTask } from './services/geminiService';
import { MagicWand } from './components/MagicWand';
import { TaskCard } from './components/TaskCard';

const ROLE_DISPLAY: Record<UserRole, string> = {
  admin: 'Business Owner (Admin)',
  manager: 'Operations Lead / Manager',
  teammate: 'Field Teammate / Staff'
};

const INITIAL_TENANTS: Tenant[] = [
  { id: 't-default', name: 'Ajinkya Infotech', industry: 'IT Services', createdAt: Date.now() }
];

const INITIAL_USERS: User[] = [
  { id: 'u-admin-0', tenantId: 't-default', username: 'admin1', password: '1234', name: 'Rupesh Kanade', role: 'admin', jobProfile: ROLE_DISPLAY.admin, isActive: true },
];

const App: React.FC = () => {
  // Global SaaS States
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Auth & Session
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  
  // UI Flow States
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [regForm, setRegForm] = useState({ companyName: '', industry: '', adminName: '', username: '', password: '' });

  // Dashboard / Workroom States
  const [view, setView] = useState<'tasks' | 'teammates' | 'dashboard' | 'settings'>('tasks');
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [isCrisping, setIsCrisping] = useState(false);
  const [previewSteps, setPreviewSteps] = useState<string[]>([]);
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [selectedTeammateId, setSelectedTeammateId] = useState<string>('');
  const [priorityInput, setPriorityInput] = useState<TaskPriority>('moderate');
  const [dueDateInput, setDueDateInput] = useState<string>('');
  const [commentInput, setCommentInput] = useState('');

  // Modals & Management
  const [isAddingTeammate, setIsAddingTeammate] = useState(false);
  const [editingTeammate, setEditingTeammate] = useState<Teammate | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [newMemberForm, setNewMemberForm] = useState({
    name: '', email: '', contact: '', username: '', role: 'teammate' as UserRole, jobProfile: '', skills: '', managerId: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // --- SaaS Partitioning: Strict Filters ---
  
  const tenantTasks = useMemo(() => 
    tasks.filter(t => t.tenantId === activeTenant?.id),
    [tasks, activeTenant]
  );

  const tenantTeammates = useMemo(() => 
    teammates.filter(t => t.tenantId === activeTenant?.id),
    [teammates, activeTenant]
  );

  const tenantUsers = useMemo(() => 
    users.filter(u => u.tenantId === activeTenant?.id),
    [users, activeTenant]
  );

  const tenantNotifications = useMemo(() => 
    notifications.filter(n => n.tenantId === activeTenant?.id),
    [notifications, activeTenant]
  );

  // --- View Filtering based on Role (Strict Scoping) ---

  const filteredTasks = useMemo(() => {
    if (!currentUser || !activeTenant) return [];
    if (currentUser.role === 'admin') return tenantTasks;
    if (currentUser.role === 'manager') {
      const myTeamIds = tenantTeammates.filter(t => t.managerId === currentUser.id).map(t => t.id);
      return tenantTasks.filter(t => t.assigneeId && (myTeamIds.includes(t.assigneeId) || t.assigneeId === currentUser.teammateId));
    }
    return tenantTasks.filter(t => t.assigneeId === currentUser.teammateId);
  }, [tenantTasks, currentUser, activeTenant, tenantTeammates]);

  const teammatesInDirectory = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return tenantTeammates;
    if (currentUser.role === 'manager') return tenantTeammates.filter(t => t.managerId === currentUser.id);
    return [];
  }, [tenantTeammates, currentUser]);

  const availableTeammates = useMemo(() => {
    if (!currentUser) return [];
    // For assigning tasks: 
    // Admin sees everyone.
    // Manager sees their assigned teammates.
    if (currentUser.role === 'admin') return tenantTeammates.filter(t => t.isActive);
    if (currentUser.role === 'manager') return tenantTeammates.filter(t => t.isActive && t.managerId === currentUser.id);
    return [];
  }, [tenantTeammates, currentUser]);

  const stats: TaskStats = useMemo(() => {
    const now = Date.now();
    const myTasks = filteredTasks;
    const total = myTasks.length;
    const completed = myTasks.filter(t => t.status === 'completed').length;
    const pending = myTasks.filter(t => t.status === 'pending').length;
    const overdue = myTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < now).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, completionRate };
  }, [filteredTasks]);

  const unreadNotifications = useMemo(() => 
    currentUser ? tenantNotifications.filter(n => n.userId === currentUser.id && !n.isRead) : [],
    [tenantNotifications, currentUser]
  );

  const selectedTask = useMemo(() => 
    tenantTasks.find(t => t.id === selectedTaskId) || null,
    [tenantTasks, selectedTaskId]
  );

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTask?.comments]);

  // --- Core Handlers ---

  const handleRegisterCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.companyName || !regForm.username || !regForm.password) return;

    const newTenantId = `t-${Math.random().toString(36).substr(2, 9)}`;
    const newTenant: Tenant = {
      id: newTenantId,
      name: regForm.companyName,
      industry: regForm.industry || 'General',
      createdAt: Date.now()
    };

    const newAdminUser: User = {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: newTenantId,
      username: regForm.username.toLowerCase(),
      password: regForm.password,
      name: regForm.adminName,
      role: 'admin',
      jobProfile: ROLE_DISPLAY.admin,
      isActive: true
    };

    setTenants(prev => [...prev, newTenant]);
    setUsers(prev => [...prev, newAdminUser]);
    setIsRegistering(false);
    alert(`Company "${regForm.companyName}" registered! Log in with your admin credentials.`);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginInput.username.toLowerCase());
    const expectedPassword = user?.password || '1234';
    if (user && loginInput.password === expectedPassword) {
      if (!user.isActive) {
        setLoginError('Account disabled. Contact Business Owner.');
        return;
      }
      const tenant = tenants.find(t => t.id === user.tenantId);
      if (!tenant) {
        setLoginError('Invalid tenant association.');
        return;
      }
      setCurrentUser(user);
      setActiveTenant(tenant);
      setLoginError('');
      setLoginInput({ username: '', password: '' });
    } else {
      setLoginError('Incorrect login details.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTenant(null);
    setSelectedTaskId(null);
    setView('tasks');
    setShowNotifications(false);
  };

  const triggerNotification = (userId: string, title: string, message: string, type: NotificationType, relatedTaskId: string) => {
    if (!activeTenant) return;
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: activeTenant.id,
      userId,
      title,
      message,
      type,
      relatedTaskId,
      isRead: false,
      timestamp: Date.now()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleCrisp = async () => {
    if (!rawInput.trim()) return;
    setIsCrisping(true);
    try {
      const response = await distillTask(rawInput);
      setPreviewSteps(response.steps);
      setSuggestedTitle(response.suggestedTitle);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCrisping(false);
    }
  };

  const handleAssign = () => {
    if (previewSteps.length === 0 || !activeTenant) return;
    const teammate = tenantTeammates.find(t => t.id === selectedTeammateId);
    
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      tenantId: activeTenant.id,
      title: suggestedTitle,
      rawInput,
      steps: previewSteps.filter(t => t.trim() !== '').map(text => ({
        id: Math.random().toString(36).substr(2, 9),
        text,
        isCompleted: false
      })),
      comments: [],
      assignee: teammate?.name || 'Unassigned',
      assigneeId: selectedTeammateId,
      createdAt: Date.now(),
      dueDate: dueDateInput ? new Date(dueDateInput).getTime() : undefined,
      status: 'pending',
      priority: priorityInput
    };

    setTasks(prev => [newTask, ...prev]);

    // Notify Assignee
    const assigneeUser = tenantUsers.find(u => u.teammateId === selectedTeammateId);
    if (assigneeUser) {
      triggerNotification(assigneeUser.id, 'New Task Assigned!', `You have been assigned: ${suggestedTitle}`, 'task_assigned', newTask.id);
    }

    setRawInput('');
    setPreviewSteps([]);
    setSuggestedTitle('');
    setSelectedTeammateId('');
    setPriorityInput('moderate');
    setDueDateInput('');
  };

  const toggleStepInTask = (taskId: string, stepId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSteps = t.steps.map(s => s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s);
        const allDone = newSteps.every(s => s.isCompleted);
        const wasPending = t.status === 'pending';
        
        if (wasPending && allDone) {
          const teammate = tenantTeammates.find(tm => tm.id === t.assigneeId);
          if (teammate?.managerId) {
             triggerNotification(teammate.managerId, 'Task Completed!', `${teammate.name} finished: ${t.title}`, 'task_completed', t.id);
          }
          const admin = tenantUsers.find(u => u.role === 'admin');
          if (admin) {
            triggerNotification(admin.id, 'Task Finished', `${teammate?.name || 'A teammate'} finished ${t.title}`, 'task_completed', t.id);
          }
        }

        return { ...t, steps: newSteps, status: allDone ? 'completed' : 'pending', completedAt: allDone ? Date.now() : undefined };
      }
      return t;
    }));
  };

  const handleOnboardMember = () => {
    if (!activeTenant) return;
    const id = Math.random().toString(36).substr(2, 9);
    const userId = `u-${id}`;
    
    const newUser: User = {
      id: userId,
      tenantId: activeTenant.id,
      username: newMemberForm.username.toLowerCase(),
      password: '1234',
      name: newMemberForm.name,
      role: newMemberForm.role,
      jobProfile: newMemberForm.jobProfile || ROLE_DISPLAY[newMemberForm.role],
      isActive: true,
      teammateId: newMemberForm.role === 'admin' ? undefined : id
    };

    if (newMemberForm.role !== 'admin') {
       const newTeammate: Teammate = {
         id: id,
         tenantId: activeTenant.id,
         name: newMemberForm.name,
         jobProfile: newMemberForm.jobProfile || ROLE_DISPLAY[newMemberForm.role],
         contact: newMemberForm.contact,
         email: newMemberForm.email,
         username: newMemberForm.username,
         skills: newMemberForm.skills,
         isActive: true,
         managerId: newMemberForm.managerId || undefined
       };
       setTeammates(prev => [...prev, newTeammate]);
    }

    setUsers(prev => [...prev, newUser]);
    setIsAddingTeammate(false);
    setNewMemberForm({ name: '', email: '', contact: '', username: '', role: 'teammate', jobProfile: '', skills: '', managerId: '' });
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTenant) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      if (lines.length < 2) return;

      const newUsersList = [...users];
      const newTeammatesList = [...teammates];
      const importQueue: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length < 7) continue;

        const [name, username, email, contact, rawRole, jobProfile, skills, managerUsername] = parts.map(p => p.trim().replace(/^"|"$/g, ''));
        const normalizedRole = rawRole.toLowerCase() as UserRole;
        const finalRole: UserRole = ['admin', 'manager', 'teammate'].includes(normalizedRole) ? normalizedRole : 'teammate';

        if (newUsersList.some(u => u.username.toLowerCase() === username.toLowerCase() && u.tenantId === activeTenant.id)) continue;

        const internalId = Math.random().toString(36).substr(2, 9);
        const userId = `u-${internalId}`;
        
        const newUser: User = {
          id: userId,
          tenantId: activeTenant.id,
          username: username.toLowerCase(),
          password: '1234',
          name: name,
          role: finalRole,
          jobProfile: jobProfile || ROLE_DISPLAY[finalRole],
          isActive: true,
          teammateId: finalRole === 'admin' ? undefined : internalId
        };
        
        newUsersList.push(newUser);
        importQueue.push({ internalId, userId, name, username, email, contact, role: finalRole, jobProfile, skills, managerUsername });
      }

      // Second pass for manager hierarchy
      importQueue.forEach(item => {
        if (item.role !== 'admin') {
          const mgr = newUsersList.find(u => u.username.toLowerCase() === item.managerUsername?.toLowerCase() && u.tenantId === activeTenant.id);
          const newTeammate: Teammate = {
            id: item.internalId,
            tenantId: activeTenant.id,
            name: item.name,
            jobProfile: item.jobProfile || ROLE_DISPLAY[item.role as UserRole],
            contact: item.contact,
            email: item.email,
            username: item.username,
            skills: item.skills,
            isActive: true,
            managerId: mgr?.id
          };
          newTeammatesList.push(newTeammate);
        }
      });

      setUsers(newUsersList);
      setTeammates(newTeammatesList);
      alert('Hierarchy imported successfully!');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportCSV = () => {
    if (!activeTenant) return;
    const headers = ['Name', 'Username', 'Email', 'Contact', 'Role', 'JobProfile', 'Skills', 'ManagerUsername'];
    const rows = tenantTeammates.map(t => {
      const mgr = tenantUsers.find(u => u.id === t.managerId);
      const userRecord = tenantUsers.find(u => u.teammateId === t.id || u.username === t.username);
      return [
        t.name, t.username, t.email, t.contact,
        userRecord?.role || 'teammate', t.jobProfile,
        `"${t.skills.replace(/"/g, '""')}"`, mgr?.username || ''
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTenant.name}_Backup.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const managers = useMemo(() => tenantUsers.filter(u => (u.role === 'manager' || u.role === 'admin') && u.isActive), [tenantUsers]);

  if (!currentUser || !activeTenant) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border border-slate-200">
          <div className="flex justify-center mb-8">
            <div className="bg-purple-600 p-5 rounded-3xl shadow-xl shadow-purple-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M11 12h6"/><path d="M11 16h6"/><path d="M11 20h6"/><path d="M13 3H3v18h18V11"/></svg>
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-center text-slate-900 mb-2">{isRegistering ? 'SaaS Registration' : 'TwoDay SmarTask'}</h1>
          <p className="text-center text-slate-400 text-sm mb-10 font-medium italic">Play to Win</p>

          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System User ID</label>
                <input type="text" value={loginInput.username} onChange={e => setLoginInput({...loginInput, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold" placeholder="e.g. admin1" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Security Key</label>
                <input type="password" value={loginInput.password} onChange={e => setLoginInput({...loginInput, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold" placeholder="••••" />
              </div>
              {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}
              <button className="w-full bg-purple-600 text-white py-5 rounded-[25px] font-black text-lg hover:bg-purple-700 shadow-xl shadow-purple-100 transition-all active:scale-[0.98]">Enter Workroom</button>
              <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-purple-600">Register My Company</button>
            </form>
          ) : (
            <form onSubmit={handleRegisterCompany} className="space-y-4">
              <input type="text" placeholder="Company Name" value={regForm.companyName} onChange={e => setRegForm({...regForm, companyName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" required />
              <input type="text" placeholder="Industry" value={regForm.industry} onChange={e => setRegForm({...regForm, industry: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" />
              <div className="h-px bg-slate-100 my-4" />
              <input type="text" placeholder="Admin Full Name" value={regForm.adminName} onChange={e => setRegForm({...regForm, adminName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" required />
              <input type="text" placeholder="Admin Username" value={regForm.username} onChange={e => setRegForm({...regForm, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" required />
              <input type="password" placeholder="Admin Password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" required />
              <button className="w-full bg-slate-900 text-white py-5 rounded-[25px] font-black hover:bg-black transition-all">Launch Company Instance</button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest">Back to Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2.5 rounded-xl shadow-lg shadow-purple-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M11 12h6"/><path d="M11 16h6"/><path d="M11 20h6"/><path d="M13 3H3v18h18V11"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">{activeTenant.name}</h1>
              <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest mt-1">
                {currentUser.role === 'admin' ? `BUSINESS OWNER (ADMIN): ${currentUser.name.toUpperCase()}` : `${currentUser.jobProfile}: ${currentUser.name}`}
              </p>
            </div>
          </div>
          
          <nav className="hidden md:flex gap-1 bg-slate-100 p-1.5 rounded-2xl">
            <button onClick={() => setView('tasks')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'tasks' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Workroom</button>
            {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
              <>
                <button onClick={() => setView('dashboard')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'dashboard' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Reports</button>
                <button onClick={() => setView('teammates')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'teammates' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Team Setup</button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
             <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2.5 rounded-xl transition-all ${unreadNotifications.length > 0 ? 'text-purple-600 bg-purple-50' : 'text-slate-400 hover:text-purple-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                {unreadNotifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-[30px] shadow-2xl border border-slate-100 py-6 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-6 pb-4 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Company Alerts</h3>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {unreadNotifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-300 font-bold text-xs uppercase italic">No activity yet</div>
                    ) : (
                      unreadNotifications.map(n => (
                        <div key={n.id} onClick={() => { setSelectedTaskId(n.relatedTaskId); setShowNotifications(false); setView('tasks'); }} className="p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 flex gap-3">
                          <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${n.type === 'task_completed' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'}`}>
                             {n.type === 'task_completed' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14"/><path d="M5 12h14"/></svg>}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-900 leading-tight mb-1">{n.title}</p>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{n.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg></button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around p-2 z-40 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.03)] rounded-t-[20px]">
        <button 
          onClick={() => setView('tasks')} 
          className={`flex flex-col items-center gap-1 p-2 flex-1 transition-all ${view === 'tasks' ? 'text-purple-600' : 'text-slate-400'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span className="text-[9px] font-black uppercase tracking-tighter">Workroom</span>
        </button>
        {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
          <>
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex flex-col items-center gap-1 p-2 flex-1 transition-all ${view === 'dashboard' ? 'text-purple-600' : 'text-slate-400'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter">Reports</span>
            </button>
            <button 
              onClick={() => setView('teammates')} 
              className={`flex flex-col items-center gap-1 p-2 flex-1 transition-all ${view === 'teammates' ? 'text-purple-600' : 'text-slate-400'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="text-[9px] font-black uppercase tracking-tighter">Team</span>
            </button>
          </>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {view === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
              <div className="lg:col-span-7 space-y-8">
                <div className="bg-white rounded-[50px] shadow-2xl border border-slate-100 overflow-hidden">
                  <div className="p-8 md:p-12">
                    <div className="flex justify-between items-center mb-8">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Instruction Brain-Dump</label>
                      <span className="text-[10px] text-purple-600 font-black px-3 py-1 bg-purple-50 rounded-lg uppercase">AI Instruction Engine</span>
                    </div>
                    <textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} placeholder="Explain the task plainly (Hinglish/English)..." className="w-full min-h-[180px] text-2xl font-bold text-slate-800 placeholder:text-slate-200 border-none focus:ring-0 resize-none p-0 mb-6" />
                    <div className="flex items-center justify-end pt-6 border-t border-slate-50">
                      <MagicWand onClick={handleCrisp} isLoading={isCrisping} disabled={!rawInput.trim()} />
                    </div>
                  </div>
                  {(previewSteps.length > 0 || isCrisping) && (
                    <div className="bg-slate-50 border-t border-slate-100 p-8 md:p-12 animate-in slide-in-from-top-4">
                       {isCrisping ? <div className="animate-pulse space-y-4"><div className="h-14 bg-slate-200 rounded-[30px] w-full" /><div className="h-14 bg-slate-200 rounded-[30px] w-5/6" /></div> : (
                         <>
                            <div className="space-y-3 mb-10">
                              {previewSteps.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-4 bg-white p-6 rounded-[30px] border border-slate-100 shadow-sm">
                                  <span className="w-8 h-8 flex items-center justify-center bg-purple-50 text-purple-600 rounded-xl text-xs font-black">{idx + 1}</span>
                                  <input type="text" value={step} onChange={(e) => setPreviewSteps(prev => prev.map((s, i) => i === idx ? e.target.value : s))} className="flex-grow bg-transparent border-none focus:ring-0 text-slate-700 font-bold py-0" />
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                               <select value={selectedTeammateId} onChange={(e) => setSelectedTeammateId(e.target.value)} className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[30px] font-black text-slate-800 text-sm appearance-none outline-none focus:ring-2 focus:ring-purple-500">
                                  <option value="">Assign To Teammate...</option>
                                  {availableTeammates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.jobProfile})</option>)}
                               </select>
                               <select value={priorityInput} onChange={(e) => setPriorityInput(e.target.value as TaskPriority)} className="w-full px-6 py-5 bg-white border border-slate-100 rounded-[30px] font-black text-slate-800 text-sm appearance-none outline-none">
                                  <option value="high">Urgent Priority</option>
                                  <option value="moderate">Normal Priority</option>
                                  <option value="low">Flexible Priority</option>
                               </select>
                            </div>
                            <button onClick={handleAssign} disabled={!selectedTeammateId} className="w-full bg-slate-900 text-white py-6 rounded-[30px] font-black text-xl hover:bg-black transition-all shadow-2xl shadow-slate-200 uppercase tracking-tight active:scale-95">Deploy Task</button>
                         </>
                       )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className={(currentUser.role === 'manager' || currentUser.role === 'admin') ? "lg:col-span-5 space-y-6" : "lg:col-span-12 space-y-6"}>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6">Live Pipeline</h2>
              <div className={currentUser.role === 'teammate' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-6"}>
                {filteredTasks.length === 0 ? <div className="py-24 text-center bg-white rounded-[60px] border-2 border-dashed border-slate-100 text-slate-200 font-black uppercase italic text-sm">No Active Tasks</div> : filteredTasks.map(task => <TaskCard key={task.id} task={task} onClick={(t) => setSelectedTaskId(t.id)} />)}
              </div>
            </div>
          </div>
        )}

        {view === 'teammates' && (
          <div className="space-y-10 animate-in fade-in">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                   <h2 className="text-4xl font-black text-slate-900">{activeTenant.name} Staff</h2>
                   <p className="text-slate-500 font-medium italic mt-2">Manage restricted tenant data.</p>
                </div>
                {currentUser.role === 'admin' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none px-6 py-4 bg-white border border-slate-200 rounded-[25px] font-black text-xs text-slate-600 hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 8 12 3 7 8"/><path d="M12 3v12"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg> Import
                    </button>
                    <button onClick={handleExportCSV} className="flex-1 md:flex-none px-6 py-4 bg-white border border-slate-200 rounded-[25px] font-black text-xs text-slate-600 hover:bg-slate-50 shadow-sm flex items-center justify-center gap-2">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Export
                    </button>
                    <button onClick={() => setIsAddingTeammate(true)} className="w-full md:w-auto bg-purple-600 text-white px-8 py-4 rounded-[25px] font-black text-xs shadow-xl shadow-purple-100 hover:bg-purple-700 transition-all uppercase tracking-widest">Add Member</button>
                  </div>
                )}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {teammatesInDirectory.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-[50px] border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase tracking-tighter">No Team Members Onboarded</div>
                ) : teammatesInDirectory.map(t => {
                   const mgr = tenantUsers.find(u => u.id === t.managerId);
                   return (
                    <div key={t.id} onClick={() => setEditingTeammate(t)} className="bg-white p-10 md:p-12 rounded-[50px] border-2 border-slate-50 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-black text-2xl mb-8 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">{t.name.charAt(0)}</div>
                      <h3 className="text-2xl font-black text-slate-900">{t.name}</h3>
                      <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1 mb-8">{t.jobProfile}</p>
                      <div className="space-y-3 pt-6 border-t border-slate-50">
                         <div className="flex items-center gap-3 text-xs font-bold text-slate-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{t.contact}</div>
                         <div className="flex items-center gap-3 text-xs font-bold text-slate-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>{t.email}</div>
                         {mgr && <p className="text-[10px] font-black text-purple-600 uppercase mt-4">Managed By: {mgr.name}</p>}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-10 md:p-12 rounded-[50px] shadow-sm border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Workload</p>
                   <p className="text-5xl md:text-6xl font-black text-slate-900 leading-tight">{stats.total}</p>
                </div>
                <div className="bg-white p-10 md:p-12 rounded-[50px] shadow-sm border border-green-50">
                   <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Tasks Completed</p>
                   <p className="text-5xl md:text-6xl font-black text-slate-900 leading-tight">{stats.completed}</p>
                </div>
                <div className="bg-white p-10 md:p-12 rounded-[50px] shadow-sm border border-red-50">
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Overdue Blockers</p>
                   <p className="text-5xl md:text-6xl font-black text-slate-900 leading-tight">{stats.overdue}</p>
                </div>
                <div className="bg-purple-600 p-10 md:p-12 rounded-[50px] text-white shadow-2xl shadow-purple-100">
                   <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mb-1">Efficiency Rate</p>
                   <p className="text-5xl md:text-6xl font-black leading-tight">{stats.completionRate}%</p>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-6xl h-[94vh] rounded-[40px] md:rounded-[70px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-8 md:p-14 border-b flex justify-between items-center bg-white z-10">
                <div>
                   <h2 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight">{selectedTask.title}</h2>
                   <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-2">{activeTenant.name} Pipeline • {selectedTask.assignee}</p>
                </div>
                <button onClick={() => setSelectedTaskId(null)} className="p-4 md:p-6 bg-slate-50 rounded-[20px] md:rounded-[30px] text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
             </div>
             <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <div className="flex-1 p-8 md:p-14 overflow-y-auto space-y-6">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Action Checklist</label>
                   {selectedTask.steps.map(s => (
                     <div key={s.id} onClick={() => toggleStepInTask(selectedTask.id, s.id)} className={`flex items-center gap-6 p-6 md:p-8 rounded-[30px] md:rounded-[40px] border-2 transition-all cursor-pointer ${s.isCompleted ? 'bg-green-50 border-green-100 opacity-60' : 'bg-white border-slate-50 hover:border-purple-200 active:scale-98 shadow-sm'}`}>
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${s.isCompleted ? 'bg-green-500 border-green-500' : 'bg-slate-50 border-slate-200'}`}>
                           {s.isCompleted && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>}
                        </div>
                        <span className={`text-lg md:text-xl font-bold ${s.isCompleted ? 'line-through text-green-700' : 'text-slate-800'}`}>{s.text}</span>
                     </div>
                   ))}
                </div>
                <div className="w-full md:w-[400px] bg-slate-50 flex flex-col border-l border-slate-100">
                   <div className="p-6 md:p-8 border-b font-black text-[10px] uppercase tracking-widest text-slate-400">Roadblocks / Comments</div>
                   <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-4">
                      {selectedTask.comments.map(c => (
                        <div key={c.id} className={`flex flex-col ${c.authorName === currentUser.name ? 'items-end' : 'items-start'}`}>
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{c.authorName}</p>
                           <div className={`px-4 py-3 rounded-2xl text-xs font-bold ${c.authorName === currentUser.name ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none shadow-sm'}`}>{c.text}</div>
                        </div>
                      ))}
                      <div ref={commentsEndRef} />
                   </div>
                   <div className="p-6 md:p-8 bg-white border-t border-slate-50">
                      <div className="relative">
                         <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder="Type update..." className="w-full bg-slate-50 rounded-2xl py-4 pl-5 pr-12 text-sm font-bold border-none outline-none resize-none" />
                         <button onClick={() => {
                            if(!commentInput.trim() || !activeTenant) return;
                            const newComment: Comment = { id: Math.random().toString(36).substr(2,9), text: commentInput, authorName: currentUser.name, authorRole: currentUser.role, timestamp: Date.now() };
                            setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, comments: [...t.comments, newComment] } : t));
                            setCommentInput('');
                         }} className="absolute right-2 bottom-2 p-3 bg-purple-600 text-white rounded-xl shadow-lg active:scale-90"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Onboarding / Edit Modal */}
      {(isAddingTeammate || editingTeammate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[40px] md:rounded-[60px] p-10 md:p-16 shadow-2xl animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{editingTeammate ? 'Member Profile' : 'Staff Onboarding'}</h2>
              <p className="text-slate-400 font-medium mb-12 italic">Grant secure access to {activeTenant.name}.</p>
              <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" disabled={!!editingTeammate && currentUser.role !== 'admin'} placeholder="Full Name" value={editingTeammate ? editingTeammate.name : newMemberForm.name} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, name: e.target.value}) : setNewMemberForm({...newMemberForm, name: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="text" disabled={!!editingTeammate} placeholder="Username (Login ID)" value={editingTeammate ? editingTeammate.username : newMemberForm.username} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, username: e.target.value}) : setNewMemberForm({...newMemberForm, username: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" disabled={!!editingTeammate && currentUser.role !== 'admin'} placeholder="Contact Number" value={editingTeammate ? editingTeammate.contact : newMemberForm.contact} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, contact: e.target.value}) : setNewMemberForm({...newMemberForm, contact: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="email" disabled={!!editingTeammate && currentUser.role !== 'admin'} placeholder="Email Address" value={editingTeammate ? editingTeammate.email : newMemberForm.email} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, email: e.target.value}) : setNewMemberForm({...newMemberForm, email: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select disabled={!!editingTeammate && currentUser.role !== 'admin'} value={editingTeammate ? (tenantUsers.find(u => u.teammateId === editingTeammate.id)?.role || 'teammate') : newMemberForm.role} onChange={e => setNewMemberForm({...newMemberForm, role: e.target.value as UserRole})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-black appearance-none outline-none">
                       <option value="teammate">Field Teammate</option>
                       <option value="manager">Operations Lead</option>
                    </select>
                    <select disabled={!!editingTeammate && currentUser.role !== 'admin'} value={editingTeammate ? editingTeammate.managerId : newMemberForm.managerId} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, managerId: e.target.value}) : setNewMemberForm({...newMemberForm, managerId: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-black appearance-none outline-none">
                       <option value="">No Manager Assigned</option>
                       {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                 </div>
                 <input type="text" disabled={!!editingTeammate && currentUser.role !== 'admin'} placeholder="Job Profile (e.g. Senior Driver)" value={editingTeammate ? editingTeammate.jobProfile : newMemberForm.jobProfile} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, jobProfile: e.target.value}) : setNewMemberForm({...newMemberForm, jobProfile: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500" />
                 <textarea disabled={!!editingTeammate && currentUser.role !== 'admin'} placeholder="Skills & Strengths..." value={editingTeammate ? editingTeammate.skills : newMemberForm.skills} onChange={e => editingTeammate ? setEditingTeammate({...editingTeammate, skills: e.target.value}) : setNewMemberForm({...newMemberForm, skills: e.target.value})} className="w-full px-8 py-5 bg-slate-50 rounded-[25px] font-bold border-none outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] resize-none" />
              </div>
              <div className="flex flex-col md:flex-row gap-4 mt-12">
                 <button onClick={() => { setIsAddingTeammate(false); setEditingTeammate(null); }} className="order-2 md:order-1 flex-1 py-5 text-slate-400 font-black text-sm uppercase tracking-widest">Cancel</button>
                 {(!editingTeammate || currentUser.role === 'admin') && (
                   <button onClick={editingTeammate ? () => {
                     setTeammates(prev => prev.map(t => t.id === editingTeammate.id ? editingTeammate : t));
                     setUsers(prev => prev.map(u => u.teammateId === editingTeammate.id ? { ...u, name: editingTeammate.name } : u));
                     setEditingTeammate(null);
                   } : handleOnboardMember} className="order-1 md:order-2 flex-1 py-5 bg-purple-600 text-white font-black rounded-[25px] shadow-2xl shadow-purple-100 hover:bg-purple-700 transition-all uppercase tracking-tighter">
                     {editingTeammate ? 'Update Profile' : 'Onboard Member'}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
