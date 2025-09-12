import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Home from '../pages/Home.vue'
import Recipes from '../pages/Recipes.vue'
import Planner from '../pages/Planner.vue'
import Learn from '../pages/Learn.vue'
import Login from '../pages/Login.vue'
import Register from '@/pages/Register.vue'
import AdminDashboard from '@/pages/AdminDashboard.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: Recipes,
    meta: { requiresAuth: true } 
  },
  {
    path: '/planner',
    name: 'planner',
    component: Planner,
    meta: { requiresAuth: true }
  },
  {
    path: '/learn',
    name: 'learn',
    component: Learn,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',    
    component: Login
  },
  {
    path: '/register',
    name: 'register',  
    component: Register
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminDashboard,
    meta: { 
      requiresAuth: true,
      adminOnly: true
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      getAuth(),
      (user) => {
        removeListener()
        resolve(user)
      },
      reject
    )
  })
}

router.beforeEach(async (to, from, next) => {
  const user = await getCurrentUser()
  
  // Check if user is admin
  const isAdmin = user?.email === 'admin@gmail.com'

  // If admin tries to access login/register, redirect to admin dashboard
  if (isAdmin && (to.name === 'login' || to.name === 'register')) {
    next({ name: 'admin' })
    return
  }

  // Public routes for non-admin users
  if (to.name === 'home' || to.name === 'login' || to.name === 'register') {
    next()
    return
  }

  // Check authentication
  if (to.meta.requiresAuth) {
    if (!user) {
      console.log('Unauthorized access, redirecting to login')
      next({ name: 'login' })
      return
    }

    // Admin route check
    if (to.meta.adminOnly) {
      if (!isAdmin) {
        console.log('Admin access denied, redirecting to home')
        next({ name: 'home' })
        return
      }
    }
    // Allow access
    console.log('Access granted')
    next()
  } else {
    next()
  }
})

export default router