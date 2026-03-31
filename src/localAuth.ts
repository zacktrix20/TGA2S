// Simple local authentication system for farmers
// Stores user data in localStorage

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  password: string; // In production, this would be hashed
  createdAt: string;
}

const USERS_KEY = 'tgas_users';
const CURRENT_USER_KEY = 'tgas_current_user';

export const localAuth = {
  // Sign up a new farmer
  signup: (name: string, email: string, password: string): LocalUser => {
    if (!name || !email || !password) {
      throw new Error('Jaza sehemu zote');
    }
    
    const users = getAllUsers();
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      throw new Error('Barua pepe hii tayari ina akaunti');
    }
    
    if (password.length < 6) {
      throw new Error('Nenosiri linapaswa kuwa na angalau herufi 6');
    }
    
    const newUser: LocalUser = {
      id: 'user_' + Date.now(),
      name,
      email,
      password, // In production, hash this!
      createdAt: new Date().toISOString(),
    };
    
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    console.log('✅ Account created:', name);
    return newUser;
  },

  // Sign in existing farmer
  signin: (email: string, password: string): LocalUser => {
    if (!email || !password) {
      throw new Error('Jaza sehemu zote');
    }
    
    const users = getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Barua pepe hii haipatikani');
    }
    
    if (user.password !== password) {
      throw new Error('Nenosiri si sahihi');
    }
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    console.log('✅ Signed in:', user.name);
    return user;
  },

  // Get current logged-in user
  getCurrentUser: (): LocalUser | null => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  // Log out
  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    console.log('✅ Logged out');
  },

  // Helper: Get all users
  getAllUsers: (): LocalUser[] => {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  },
};

function getAllUsers(): LocalUser[] {
  const stored = localStorage.getItem(USERS_KEY);
  return stored ? JSON.parse(stored) : [];
}
