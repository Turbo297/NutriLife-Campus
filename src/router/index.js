import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Home from '../pages/Home.vue'
import Recipes from '../pages/Recipes.vue'
import Planner from '../pages/Planner.vue'
import Login from '../pages/Login.vue'
import Register from '@/pages/Register.vue'
import AdminDashboard from '@/pages/AdminDashboard.vue'
import Events from '@/pages/Events.vue'
import Map from '@/pages/Map.vue'
import AdminRegistrations from '@/pages/AdminRegistrations.vue'
import AdminEvents from '@/pages/AdminEvents.vue'
import AdminRecipes from '@/pages/AdminRecipes.vue'
import EventForm from '@/pages/EventForm.vue'
import Profile from '@/pages/Profile.vue'
const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/profile',
    name: 'profile',
    component: Profile,
    meta: { requiresAuth: true }
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
    path: '/map',
    name: 'map',
    component: Map,
    meta: { requiresAuth: true }
  },
  {
    path: '/events',
    name: 'events',
    component: Events,
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
  },
  { 
    path: '/admin/registrations', 
    name: 'admin-registrations',
    component: AdminRegistrations,
    meta: { requiresAuth: true, adminOnly: true } 
  },
  {
    path: '/admin/events',
    name: 'admin-events',
    component: AdminEvents,
    meta: { requiresAuth: true, adminOnly: true }
  },
  {   
    path: '/admin/recipes',
    name: 'admin-recipes',
    component: AdminRecipes,
    meta: { requiresAuth: true, adminOnly: true }
  },
  {
  path: '/admin/events/new',
  name: 'admin-event-new',
  component: EventForm,
  meta: { requiresAuth: true, adminOnly: true }
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