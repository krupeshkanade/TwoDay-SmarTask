
import React from 'react';
import { Task, TaskPriority } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: 'bg-red-500 text-white',
  moderate: 'bg-blue-500 text-white',
  low: 'bg-slate-400 text-white'
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const completedCount = task.steps.filter(s => s.isCompleted).length;
  const progress = (completedCount / task.steps.length) * 100;
  
  const isOverdue = task.status !== 'completed' && task.dueDate && task.dueDate < Date.now();

  return (
    <div 
      onClick={() => onClick(task)}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] relative overflow-hidden"
    >
      {isOverdue && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 uppercase tracking-tighter rounded-bl-lg z-10">
          Overdue
        </div>
      )}
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
             <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${PRIORITY_STYLES[task.priority || 'moderate']}`}>
               {task.priority || 'moderate'}
             </span>
             <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tight uppercase ${task.status === 'completed' ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
               {task.status}
             </span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 group-hover:text-purple-600 transition-colors leading-tight">
            {task.title || `Task: ${task.id.slice(0, 8)}`}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <p className="text-[10px] font-bold text-slate-500 truncate">{task.assignee}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 line-clamp-2 italic mb-4 bg-slate-50 p-2 rounded border-l-2 border-slate-200">"{task.rawInput}"</p>

      {task.dueDate && (
        <div className="flex items-center gap-1.5 mb-4 text-[10px] font-bold text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          <span className={isOverdue ? 'text-red-500' : ''}>
            DUE: {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {task.steps.slice(0, 2).map((step) => (
          <div key={step.id} className="flex items-center gap-3 text-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.isCompleted ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className={`truncate text-xs ${step.isCompleted ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
              {step.text}
            </span>
          </div>
        ))}
        {task.steps.length > 2 && (
          <p className="text-[9px] font-black text-slate-400 pl-5">+{task.steps.length - 2} MORE STEPS</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{Math.round(progress)}% Complete</span>
      </div>
      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
        <div 
          className="bg-purple-500 h-full transition-all duration-500" 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
};
