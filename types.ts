
export type UserRole = 'admin' | 'manager' | 'teammate';

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  createdAt: number;
}

export interface TaskStep {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface Comment {
  id: string;
  text: string;
  authorName: string;
  authorRole: UserRole;
  timestamp: number;
}

export interface Teammate {
  id: string;
  tenantId: string;
  name: string;
  jobProfile: string;
  contact: string;
  email: string;
  username: string;
  skills: string;
  isActive: boolean;
  managerId?: string;
}

export type TaskPriority = 'high' | 'moderate' | 'low';

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  rawInput: string;
  steps: TaskStep[];
  comments: Comment[];
  assignee: string;
  assigneeId?: string;
  createdAt: number;
  dueDate?: number;
  completedAt?: number;
  status: 'pending' | 'completed';
  priority: TaskPriority;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
}

export interface AIResponse {
  steps: string[];
  suggestedTitle: string;
}

export interface User {
  id: string;
  tenantId: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  teammateId?: string;
  isActive: boolean;
  jobProfile: string;
}

export type NotificationType = 'task_assigned' | 'task_completed' | 'comment_added';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedTaskId: string;
  isRead: boolean;
  timestamp: number;
}
